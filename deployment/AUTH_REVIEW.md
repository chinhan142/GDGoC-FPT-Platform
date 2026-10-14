# Rà soát auth và phương án Supabase Auth — 14/10/2026

Hiện giữ NestJS auth, Prisma và bảng users trên Supabase PostgreSQL. Chưa chuyển sang Supabase Auth. Tuyển dụng không tự tạo tài khoản nội bộ. DB_TARGET chọn local/cloud riêng với auth provider.

## Đã sửa

- Reset mật khẩu dùng conditional update theo hash token, hạn sử dụng, password hash và sessionVersion. Hai request dùng cùng token chỉ một request cập nhật được. Token được lưu dạng SHA-256, random 32 byte, hạn 15 phút.
- Đổi mật khẩu dùng conditional update tránh ghi đè một lần đổi/reset đồng thời, xóa token reset đang chờ.
- JWT HS256 chứa phiên bản phiên đăng nhập; đổi/reset tăng phiên bản và thu hồi JWT cũ. Khi đổi mật khẩu từ phiên đăng nhập, BE cấp cookie mới; các thiết bị khác cần đăng nhập lại. JWT không có phiên bản từ code cũ cũng bị từ chối.
- Reset/change có giới hạn request theo IP; input token đúng 64 ký tự hex; giới hạn password mới 72 byte UTF-8 để tránh bcrypt cắt ngầm. Login input có giới hạn kích thước, tài khoản không tồn tại vẫn thực hiện một bcrypt compare nhằm giảm chênh lệch thời gian.
- Không log reset URL/token hoặc raw lỗi SMTP; thiếu SMTP trả false và token yêu cầu bị xóa theo điều kiện; chỉ trả gửi thành công khi SMTP accepted người nhận. HTML escape tên/URL, SMTP 465 TLS hoặc 587 bắt buộc STARTTLS, có timeout. Giữ nguyên template mail hiện có.
- Ghi token reset có kiểm tra password hash/version của snapshot, tránh request reset cũ ghi đè sau đổi mật khẩu. Trả thông điệp generic khi account không tồn tại hoặc gửi mail thất bại.
- Production bắt buộc JWT_SECRET dài >=32, APP_FRONTEND_URL là HTTPS origin có trong CORS. Cookie HttpOnly, Secure trong production; SameSite cấu hình qua SESSION_COOKIE_SAME_SITE. Request ghi có cookie trên production cần Origin hợp lệ. Lỗi 5xx không ghi raw exception/stack có thể chứa dữ liệu DB hoặc credential.
- Webhook tạo tài khoản cũ mặc định tắt. Chỉ bật ENABLE_LEGACY_ONBOARD_WEBHOOK=true nếu thực sự cần tích hợp cũ, dùng secret backend riêng; so sánh constant-time. Luồng onboard vẫn có mật khẩu đầu và mustChangePassword.

## Giới hạn còn lại

- Logout hiện xóa cookie trình duyệt, chưa thu hồi riêng từng JWT bị sao chép. JWT có hạn 1 ngày, bị thu hồi sau đổi/reset mật khẩu. Nếu cần quản lý thiết bị và logout từng phiên, cần bảng session/jti hoặc chuyển provider. Không coi logout hiện tại là server-side revocation.
- Rate limit ở RAM mỗi process; chạy nhiều instance cần ingress/distributed limiter. Identifier email và MSSV cùng account vẫn có bucket riêng. Forgot-password trả cùng message nhưng gửi SMTP đồng bộ tạo chênh lệch timing giữa account tồn tại và không tồn tại; cần mail outbox để xử lý kỹ hơn.
- SSE đã mở không kiểm tra lại quyền/sessionVersion trong từng heartbeat. FE đóng stream khi logout, nhưng phiên stream bị sao chép không bị cắt ngay bởi việc thu hồi JWT; cần giới hạn tuổi stream hoặc xác thực định kỳ nếu triển khai yêu cầu này.
- SameSite=lax phù hợp FE/BE cùng site. FE pages.dev và BE run.app khác site cần cấu hình phù hợp; SameSite=none + Secure vẫn có thể bị trình duyệt chặn third-party cookie. Ưu tiên domain chung hoặc proxy /api; không chuyển cookie sang localStorage để né vấn đề.
- Không có MFA, refresh/session rotation, device management hay account lock dùng chung DB. Chưa phải chứng nhận bảo mật hoặc pentest toàn hệ thống.

## Kiểm tra đã thực hiện

BE build; FE build/lint. Tests recruitment/Sheet/outbox và SMTP đều mock Google/mail. Tests auth dùng fixture PostgreSQL local trong transaction rollback: email/MSSV, JWT version, concurrent reset một lần, expiry/reuse, refresh cookie sau đổi, thu hồi token cũ, clear reset token, Unicode byte limit, throttling. Cloud chỉ đọc kết nối/migration/cấu trúc và số dòng, không đổi mật khẩu thành viên.

## Chi phí chuyển Supabase Auth

Phí dịch vụ auth cho 30–40 người nằm trong quota Free 50,000 MAU (kiểm tra theo tài liệu Supabase ngày 14/10/2026); SMTP/hosting và quota DB/Storage là phần riêng. Không cần mua Pro chỉ để chuyển auth.

Ước lượng triển khai cho repository này: khoảng 2–4 ngày làm việc gồm migration/rehearsal và kiểm thử; đây là ước lượng kỹ thuật, không phải báo giá hay cam kết tiến độ. Công việc gồm liên kết users.authUserId giữ ID nghiệp vụ, import 33 tài khoản/hash bcrypt bằng admin API tương thích, mapping email/MSSV, thay login/session/reset/change FE/BE, kiểm tra JWT Supabase, thiết lập SMTP/redirect/disable public sign-up, duy trì mustChangePassword và RBAC theo nhiệm kỳ, kiểm thử Alumni/Lv1/ban và rollback. Có thể giữ mật khẩu nếu import hash tương thích sau kiểm tra, không mặc định reset hàng loạt.

Kiến trúc nếu chuyển: Supabase Auth xác thực danh tính, NestJS vẫn kiểm tra quyền từ membership trong DB. Không mở anon quyền đọc bảng nội bộ, không thay ID user/task/Gems và không chuyển nghiệp vụ sang FE/RLS trong lần thay auth. Cần thiết kế vòng đời session rõ ràng thay vì kết hợp hai provider cho cùng tài khoản.

Nguồn: [Quota Auth](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users), [Import password hashes](https://supabase.com/docs/guides/platform/migrating-to-supabase/auth0), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
