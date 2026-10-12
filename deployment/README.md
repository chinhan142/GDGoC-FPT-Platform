# Đưa GDGoC-OS và DB local lên production

## Chọn hosting

Khuyến nghị cho lần triển khai đầu: **Railway**, một project gồm PostgreSQL, backend NestJS và frontend phục vụ bằng Caddy. Quản lý ứng dụng/DB tại một nơi, dùng private network cho BE → DB và FE → BE.

- Railway Hobby có mức tối thiểu **5 USD/tháng**, bao gồm 5 USD usage; phần dùng vượt sẽ tính thêm, không phải gói chạy không giới hạn. Free hiện có trial và mức credit nhỏ, không nên mặc định đủ vận hành cả ba service. Xem [giá Railway](https://railway.com/pricing).
- Nếu ưu tiên miễn phí để thử nghiệm: Render cho BE và Neon cho PostgreSQL là phương án cân nhắc, nhưng BE free ngủ sau 15 phút không hoạt động, ảnh hưởng realtime. PostgreSQL free của Render hết hạn sau 30 ngày, không phù hợp giữ DB production lâu dài. Xem [giới hạn Render Free](https://render.com/docs/free). Neon hiện công bố Free 1 GB/project; kiểm tra quota compute/storage trong dashboard trước khi chọn: [Neon Free plan](https://neon.com/blog/neon-free-plan-1-gb-per-project).
- Dùng dịch vụ miễn phí tách nhau cần cấu hình proxy/cookie và giám sát quota. Nếu ưu tiên ít công vận hành và ra production sớm, chọn Railway rồi theo dõi usage và bật cảnh báo ngân sách.

## Điều kiện trước khi deploy

1. FE và BE nằm trong hai repository riêng; mã nguồn cần được cập nhật trên branch `fe-integration` của cả hai repo. Commit/push phiên bản được duyệt của **cả hai repo** trước khi kết nối Railway. Hướng dẫn này không tự push hoặc tạo dịch vụ trả phí.
2. Chạy tester pack. Chưa coi hệ thống sẵn sàng chỉ vì build qua: cần xử lý/duyệt các lỗi ở tab **VanDe**, đặc biệt khả năng chuyển kỳ hai lần khi gửi request đồng thời. Guard vật tư đã thống nhất Lv1 ngày 12/10/2026; bốn bug QA đã có bản sửa và cần tester retest theo bộ tài liệu QA được gửi riêng (thư mục testing không đưa vào Git).
3. Chuẩn bị tên miền nếu có; lấy Cloudinary credentials theo [hướng dẫn Cloudinary](./CLOUDINARY.md); thông tin Discord nếu sử dụng tính năng Discord. Không đưa secret vào FE hoặc Git.
4. Chọn PostgreSQL 16 hoặc mới hơn và kiểm tra dung lượng thực tế trước khi chuyển dữ liệu.

## Tạo dịch vụ Railway

Tạo project và môi trường production, thêm **PostgreSQL**. Kết nối backend repo, đặt Root Directory là `backend`.

Backend build command:

```sh
npm ci && npm run prisma:generate && npm run build
```

Backend start command:

```sh
npm run start:prod
```

Đảm bảo build/deploy image giữ Prisma CLI để có thể chạy `npm run db:migrate`. Railway có thể thay đổi runtime/buildpack; kiểm tra Node version và CLI trong deploy logs. Có thể pin Node 24 theo môi trường đang build dự án.

Đặt các biến môi trường backend:

```dotenv
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<chuỗi-ngẫu-nhiên-riêng-tối-thiểu-32-ký-tự>
CORS_ORIGINS=https://<frontend-domain>
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
INITIAL_MEMBER_SECRET_PREFIX=<prefix-riêng-để-cấp-mật-khẩu-ban-đầu>
```

`Postgres` phải khớp tên database service thực tế. Railway cấp `PORT`; backend đã đọc biến này. Thêm các biến Discord/webhook trong `.env.example` khi dùng các tính năng tương ứng. Dùng DATABASE_URL kết nối trực tiếp/session: code SSE dùng PostgreSQL LISTEN qua cùng URL, không đổi sang transaction pooler.

**Lần đầu: chưa cho backend chạy hoặc tự migrate vào DB đích trước khi restore full dump.** Sau restore mới chạy `npm run db:migrate` trên Railway để áp dụng migration còn thiếu, rồi khởi động BE. Các lần cập nhật sau đặt lệnh này ở pre-deploy phù hợp.

## Frontend: SPA và proxy API

Cookie production hiện dùng `SameSite=Lax`. FE ở `*.vercel.app` và BE ở `*.railway.app` khác site sẽ có vấn đề đăng nhập. Cấu hình FE proxy `/api` về BE để trình duyệt dùng cùng origin; Vite dev proxy không tồn tại sau build.

Railway có [hướng dẫn SPA routing và reverse proxy](https://docs.railway.com/guides/spa-routing-configuration). Ví dụ tạo `Dockerfile` trong FE:

```dockerfile
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_RECRUITMENT_URL=
ENV VITE_API_BASE_URL=""
ENV VITE_RECRUITMENT_URL=$VITE_RECRUITMENT_URL
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
```

Tạo `Caddyfile` trong FE:

```caddyfile
:{$PORT:8080} {
    handle /api/* {
        reverse_proxy {$API_UPSTREAM} {
            flush_interval -1
        }
    }
    handle {
        root * /srv
        try_files {path} /index.html
        file_server
    }
}
```

`handle` giữ nguyên prefix `/api`; không dùng `handle_path` để xóa prefix. `flush_interval -1` phục vụ SSE. Đặt FE service variable `API_UPSTREAM=http://<backend-private-domain>:<backend-port>` theo private domain/PORT trong Railway; không đặt thành URL có `/api`. Chỉ FE cần public domain khi dùng proxy này. Nếu backend private domain dùng IPv6, đảm bảo BE lắng nghe địa chỉ phù hợp với runtime.

Tạo `.dockerignore` FE bỏ `node_modules`, `dist`, `.git`, `.env`, `.env.*` để không đóng gói secret/local files. Các ví dụ Docker/Caddy trên là hướng dẫn cấu hình, chưa được build/deploy trên Railway trong phiên này. Kiểm tra response `/api/auth/me` và SSE thực tế sau khi dựng dịch vụ.

## Chuyển DB local hiện tại, giữ dữ liệu và mật khẩu

Không import lại CSV thành viên hoặc chạy seed. Cần **full dump mới** từ DB đang dùng, gồm dữ liệu, `_prisma_migrations`, triggers/function; không dùng backup cũ trước các migration nghiệp vụ.

Tạm dừng thao tác ghi trên app local khi chốt chuyển đổi. Chạy PowerShell từ máy đang có Docker; lưu dump ở thư mục riêng ngoài Git:

```powershell
$backupDirectory = Join-Path $env:USERPROFILE 'gdgoc-private-backups'
New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
$dumpFile = Join-Path $backupDirectory ('gdgoc-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump')
docker exec gdgoc_postgres pg_dump -U gdgoc_user -d gdgoc_db --format=custom --no-owner --no-acl --file=/tmp/gdgoc-transfer.dump
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed' }
docker cp gdgoc_postgres:/tmp/gdgoc-transfer.dump $dumpFile
if ($LASTEXITCODE -ne 0) { throw 'docker cp failed' }
docker exec gdgoc_postgres pg_restore --list /tmp/gdgoc-transfer.dump
```

Không dùng PowerShell `>` để xuất binary dump. File chứa thông tin cá nhân và password hashes: giữ riêng, không commit hoặc gửi kèm tester pack.

Bật TCP public access tạm thời cho PostgreSQL Railway và lấy host/port/database/user từ **DATABASE_PUBLIC_URL** trong dashboard; không dùng private hostname trên laptop. Railway hướng dẫn tại [PostgreSQL](https://docs.railway.com/databases/postgresql).

Đọc kết nối vào biến, không ghi password trong command history:

```powershell
$targetHost = Read-Host 'Railway public DB host'
$targetPort = Read-Host 'Railway public DB port'
$targetDatabase = Read-Host 'Railway DB name'
$targetUser = Read-Host 'Railway DB user'
```

Dùng bộ PostgreSQL client đã cài trên máy, hoặc container hiện có với `docker exec -it` để nhập password khi được hỏi:

```powershell
docker exec -it gdgoc_postgres psql -W -h $targetHost -p $targetPort -U $targetUser -d $targetDatabase -c "SELECT version(); SELECT tablename FROM pg_tables WHERE schemaname='public';"
```

**DB đích phải là DB mới trống**, không có bảng ứng dụng. Nếu có bảng, dừng và chọn DB/environment mới; không tự dùng `--clean` lên dữ liệu đang có.

```powershell
docker exec -it gdgoc_postgres pg_restore -W --host=$targetHost --port=$targetPort --username=$targetUser --dbname=$targetDatabase --no-owner --no-acl --exit-on-error --single-transaction /tmp/gdgoc-transfer.dump
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; do not start application' }
```

Dùng SSL theo hướng dẫn kết nối provider (có thể đặt `PGSSLMODE=require` cho client container nếu endpoint hỗ trợ SSL). Nếu phiên bản nguồn thay đổi, dùng pg_dump/pg_restore tương thích; không restore dump mới vào PostgreSQL cũ hơn nguồn.

Sau restore: chạy migration deploy trong backend Railway, đối chiếu số users/tasks/events/contributions/Gems và số dư với DB nguồn; chạy các truy vấn đối chiếu chỉ đọc trong bộ kiểm tra DB được gửi riêng cho tester. Mật khẩu giữ nguyên vì password hashes được copy, trạng thái `mustChangePassword` cũng giữ nguyên. Upload DB không tự sửa lịch sử Gems thiếu transaction.

Tắt DB public access sau khi import/kiểm tra, BE dùng private DATABASE_URL. Bật backup định kỳ: [Railway volume backups](https://docs.railway.com/volumes/backups); backup cũng tính storage usage. Giữ thêm bản dump ngoài provider và thử restore trên environment riêng.

## Kiểm tra trước khi mở cho CLB

- Login/logout, đổi mật khẩu lần đầu, cookie Secure; reload các đường dẫn SPA không bị 404.
- Phân quyền và Alumni, task giao đúng cấp, duyệt không thưởng hai lần; event BTC → thưởng → Gems đúng kỳ.
- Hai tài khoản mở song song: task, Gems, thông báo tự cập nhật; SSE không bị proxy buffer hoặc ngắt liên tục.
- Avatar/ảnh bìa upload Cloudinary, reload và thiết bị khác vẫn đúng; file lỗi không ghi đè ảnh cũ.
- Landing public/Bevy, Drive và Discord dùng link/cấu hình thật; không còn localhost trong URL công khai.
- Backup/restore thành công, theo dõi deploy logs/usage, có bản ứng dụng trước để rollback. Rollback app không có nghĩa undo migration; cột coverUrl nullable tương thích với phiên bản cũ.

Sau khi đối chiếu xong mới đổi URL/DNS, dừng app local ghi dữ liệu để không tạo hai bản DB bị lệch. Hướng dẫn này chưa thực hiện upload DB, deploy hoặc mua hosting.
