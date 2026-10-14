# PostgreSQL trên Supabase

Ứng dụng dùng NestJS và Prisma để truy cập PostgreSQL. FE gọi API backend; không dùng Supabase Data API hoặc Supabase Auth cho nghiệp vụ nội bộ.

## Cấu hình kết nối

Lấy thông tin tại Supabase Dashboard → Connect → Session pooler, cổng 5432. Session pooler dùng IPv4 và giữ được session PostgreSQL cho listener realtime của backend. Không thay bằng transaction pooler cổng 6543 khi vẫn dùng `LISTEN`.

Tải CA tại Database → Settings → SSL Configuration → Download certificate. Backend phải đọc được file certificate khi khởi động. Cấu hình local riêng nằm trong `backend/.env.supabase`; CA local nằm trong `backend/.env.supabase-ca.crt`. Hai file được Git ignore.

```dotenv
DATABASE_URL="postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=verify-full&sslrootcert=ABSOLUTE_CA_PATH"
```

Username, password và đường dẫn certificate trong URL phải được URL encode. Dùng mật khẩu database, khác mật khẩu tài khoản Dashboard và mật khẩu thành viên ứng dụng.

File `.env.supabase` là cấu hình riêng, NestJS không tự chọn file này. Ngày 13/10/2026, `DATABASE_URL` trong `backend/.env` đã chuyển sang Supabase, nên các lệnh khởi động backend thông thường dùng DB cloud. Bản `.env` trước chuyển được lưu tại `backend/.env.before-supabase-*` và bị Git ignore; khôi phục `DATABASE_URL` từ bản đó nếu cần dùng DB local.

Khi deploy, cấp `DATABASE_URL` vào environment của backend và đặt CA trong filesystem/container; thay đường dẫn Windows local bằng đường dẫn thực tế trên hosting. Cấp thêm các biến JWT, cookie, Supabase Storage và các biến khác theo `.env.example`; chỉ đặt credential tại backend. Backend hiện chạy trên máy local và truy cập DB cloud; đổi kết nối DB không tự deploy backend lên hosting.

## Import đã thực hiện ngày 13/10/2026

- Đã backup local trước reset và tạo dump riêng gồm schema `public`, dữ liệu và lịch sử Prisma migrations; các dump chứa dữ liệu cá nhân, không commit Git.
- Đã import vào schema `public` trống trong một transaction, bỏ bước tạo/chỉnh schema `public` có sẵn và không khôi phục owner/ACL local. Các schema hệ thống Supabase không bị thay đổi.
- Kết quả: 33 thành viên, 4 task, 4 migration. Tất cả mật khẩu thành viên đã reset theo yêu cầu, bắt đổi lần đầu; số dư Gems, lịch sử Gems, events và event contributions bằng 0. Thông báo và dữ liệu còn lại được giữ.
- Bật RLS cho cả 16 bảng, thu hồi quyền truy cập bảng của `PUBLIC`, `anon`, `authenticated`. Backend dùng kết nối PostgreSQL có quyền phù hợp; không thêm policy truy cập trực tiếp từ FE vào các bảng chứa mật khẩu và thông tin nhân sự.

## Migration tiếp theo

Chạy `npm run prisma:generate`, rồi `npm run db:migrate` với environment DB đích và CA tương ứng. Không dùng `prisma migrate reset` hoặc `db push --accept-data-loss` trên production. Nếu migration tạo bảng mới, thêm RLS và kiểm tra quyền Data API ngay trong migration đó.

Kiểm tra quyền quản trị và đọc/ghi qua backend trước khi đưa frontend vào sử dụng. Import DB thành công không đồng nghĩa FE/BE đã được deploy.
