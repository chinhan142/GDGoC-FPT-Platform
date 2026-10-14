# PostgreSQL trên Supabase

Ứng dụng dùng NestJS và Prisma để truy cập PostgreSQL. FE gọi API backend; không dùng Supabase Data API hoặc Supabase Auth cho nghiệp vụ nội bộ.

## Cấu hình kết nối

Lấy thông tin tại Supabase Dashboard → Connect → Session pooler, cổng 5432. Session pooler dùng IPv4 và giữ được session PostgreSQL cho listener realtime của backend. Không thay bằng transaction pooler cổng 6543 khi vẫn dùng `LISTEN`.

Tải CA tại Database → Settings → SSL Configuration → Download certificate. Backend phải đọc được file certificate khi khởi động. Cấu hình local riêng nằm trong `backend/.env.supabase`; CA local nằm trong `backend/.env.supabase-ca.crt`. Hai file được Git ignore.

```dotenv
DATABASE_URL="postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=verify-full&sslrootcert=ABSOLUTE_CA_PATH"
```

Username, password và đường dẫn certificate trong URL phải được URL encode. Dùng mật khẩu database, khác mật khẩu tài khoản Dashboard và mật khẩu thành viên ứng dụng.

Backend và Prisma CLI cùng chọn kết nối bằng `DB_TARGET=local|cloud`. `.env` riêng hiện đã đặt `DB_TARGET=cloud` và giữ cả `LOCAL_DATABASE_URL` lẫn `CLOUD_DATABASE_URL`. Prisma/realtime sử dụng cùng DB đích. Nếu không đặt DB_TARGET, hỗ trợ `DATABASE_URL` cũ. DB_TARGET được đặt thì URL tương ứng bắt buộc có, không tự rơi về DB khác khi sai cấu hình. URL cloud bắt buộc `sslmode=verify-full`.

Đổi `.env` sang `DB_TARGET=local` để dùng local, `DB_TARGET=cloud` để dùng Supabase, rồi restart BE. Migration cũng dùng DB_TARGET đó. PowerShell có thể chạy tạm local bằng `$env:DB_TARGET='local'; npm run db:migrate`, xong `Remove-Item Env:DB_TARGET` để dùng lại giá trị `.env`. Không đổi đích DB khi BE vẫn chạy; các pool hiện có cần restart.

File cấu hình cloud riêng hiện dùng `SUPABASE_HOST`, `SUPABASE_PORT`, `SUPABASE_DATABASE`, `SUPABASE_USER`, `SUPABASE_PASSWORD`, `SUPABASE_CA_PATH`. Khi mật khẩu chứa `#`, đặt giá trị trong dấu ngoặc kép để dotenv không cắt phần sau. Các script thao tác cloud phải tạo connection string từ các biến này; không đưa URL chứa mật khẩu vào log hoặc Git.

Khi deploy, cấp `DATABASE_URL` vào environment của backend và đặt CA trong filesystem/container; thay đường dẫn Windows local bằng đường dẫn thực tế trên hosting. Cấp thêm các biến JWT, cookie, Supabase Storage và các biến khác theo `.env.example`; chỉ đặt credential tại backend. Backend hiện chạy trên máy local và truy cập DB cloud; đổi kết nối DB không tự deploy backend lên hosting.

## Import đã thực hiện ngày 13/10/2026

- Đã backup local trước reset và tạo dump riêng gồm schema `public`, dữ liệu và lịch sử Prisma migrations; các dump chứa dữ liệu cá nhân, không commit Git.
- Đã import vào schema `public` trống trong một transaction, bỏ bước tạo/chỉnh schema `public` có sẵn và không khôi phục owner/ACL local. Các schema hệ thống Supabase không bị thay đổi.
- Kết quả: 33 thành viên, 4 task, 4 migration. Tất cả mật khẩu thành viên đã reset theo yêu cầu, bắt đổi lần đầu; số dư Gems, lịch sử Gems, events và event contributions bằng 0. Thông báo và dữ liệu còn lại được giữ.
- Bật RLS cho cả 16 bảng, thu hồi quyền truy cập bảng của `PUBLIC`, `anon`, `authenticated`. Backend dùng kết nối PostgreSQL có quyền phù hợp; không thêm policy truy cập trực tiếp từ FE vào các bảng chứa mật khẩu và thông tin nhân sự.

## Migration tiếp theo

Đã áp dụng thêm `20261014020000_auth_session_version` trên cả local/cloud: `users.sessionVersion` mặc định 0. JWT mới chứa `ver`, đổi/reset mật khẩu tăng phiên bản để thu hồi JWT cũ. Cookie từ phiên bản code cũ cần đăng nhập lại một lần. Không đổi mật khẩu hoặc chuyển dữ liệu người dùng khi thêm cột.

Ngày 14/10/2026 đã đối chiếu DB local/cloud và áp dụng hai migration còn thiếu:

- `20261014000000_recruitment_outbox`: bảng `recruitment_applications` gồm hồ sơ JSON, request ID, unique theo email/MSSV trong đợt tuyển, trạng thái đồng bộ, số lần thử, mã lỗi, lịch retry, lease và thời điểm đồng bộ; enum `RecruitmentSyncStatus`; sequence mã UV bắt đầu `1000001`; index phục vụ worker. Bảng bật RLS, thu hồi quyền truy cập PUBLIC/anon/authenticated.
- `20261014010000_password_reset_tokens`: hai cột nullable `users.resetPasswordToken` và `users.resetPasswordExpires`. Local từng thêm trực tiếp nên migration dùng `ADD COLUMN IF NOT EXISTS` để ghi nhận cấu trúc mà giữ dữ liệu.

Sau cập nhật, bảng/cột/default/ràng buộc/index/enum/lịch sử migration/định nghĩa sequence/trigger/view/function của ứng dụng trong schema public đều khớp local. Không so sánh giá trị counter sequence hoặc yêu cầu dữ liệu hai DB giống nhau. Không thay các schema hệ thống auth/storage, không chuyển hồ sơ local sang cloud. Bảng recruitment trên cloud hiện trống. Số dòng trong 15 bảng cũ không đổi: giữ 33 users, 33 user tenures, 4 tasks và toàn bộ dữ liệu còn lại.

Kết quả so sánh trước/sau và số dòng nằm trong `BE/testing/outputs/cloud-schema-*.json`, bị Git ignore; chỉ chứa metadata và số lượng, không chứa hồ sơ, mật khẩu hoặc connection string. Script test không phải thành phần deployment production.

Chạy `npm run prisma:generate`, rồi `npm run db:migrate` với environment DB đích và CA tương ứng. Không dùng `prisma migrate reset` hoặc `db push --accept-data-loss` trên production. Nếu migration tạo bảng mới, thêm RLS và kiểm tra quyền Data API ngay trong migration đó.

Kiểm tra quyền quản trị và đọc/ghi qua backend trước khi đưa frontend vào sử dụng. Import DB thành công không đồng nghĩa FE/BE đã được deploy.
