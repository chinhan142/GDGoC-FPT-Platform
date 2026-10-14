# Production audit — 11/10/2026

## Trạng thái hiện tại

Code mới đã build, kiểm thử trên PostgreSQL riêng và **đã áp dụng migration trên DB local sau phê duyệt trực tiếp của bạn. Chưa triển khai production.**

Nghiệp vụ/quyền mới và các điều kiện chốt kỳ được tổng hợp trong [BUSINESS_REVIEW.md](BUSINESS_REVIEW.md).

## Kết nối dữ liệu

Tasks, events/contributions, members/user_tenures, hồ sơ, inventory_items, gems_transactions, landing_configs và drive_assets dùng API/Prisma/PostgreSQL. Không có fallback mock tạo thành công giả. Gifts/check-in được bỏ khỏi runtime; schema mới có semesters, mustChangePassword và targetUserId của notification. Realtime dùng SSE và PostgreSQL LISTEN/NOTIFY sau commit.

Drive hiện là danh mục link thật; tạo folder trả 501 do chưa cấu hình tích hợp. Quyền của app không tự thay ACL Google Workspace. CMS xuất bản nhiều API request nên có thể lưu được một phần nếu request sau lỗi.

## Kiểm chứng

- FE: TypeScript + Vite production build đạt; bundle khoảng 1.1MB, còn cảnh báo chunk lớn.
- BE: Nest build đạt; Prisma client/schema đồng bộ 7.10.0.
- Migration baseline → schema mới chạy thành công trên DB tạm có fixture cũ; diff schema trống.
- 31 kiểm thử nghiệp vụ/service/DB, 15 HTTP/SSE và 3 kiểm thử CMS lịch sử đạt. Có kiểm tra sự kiện cộng điểm đồng thời chỉ một lần, Alumni chỉ đọc, mật khẩu lần đầu, level 1 thống nhất, API cũ 404 và SSE sau commit.
- Toàn bộ database kiểm thử đã dọn; không giữ fixture trong DB CLB. Discord bị tắt khi kiểm thử. Chưa có kiểm thử thao tác UI bằng trình duyệt hoặc gửi Discord thật.

## Dữ liệu local còn giữ

Sau migration: giữ nguyên 33 users, 7 tasks (6 chưa Done), 2 events và số dư Gems/hash mật khẩu. event_contributions/gems_transactions/inventory_items/drive_assets đều 0. Bảng điểm danh/organizers/đổi quà cũ đã bỏ; 4 attendance cũ được giữ trong backup, không chuyển thành đóng góp.

Không xóa account/task/event chỉ theo tên giống seed. Cần đối soát nguồn của số dư cũ khi ledger trống; không tự reset hoặc dựng giao dịch giả. Mật khẩu cũ giữ nguyên; migration đã thêm cờ bắt đổi trước truy cập nghiệp vụ.

Backup đầy đủ ngay trước migration đã lưu ngoài workspace: C:/Users/hoang/AppData/Local/Temp/gdgoc-before-business-1791719567732.sql. Giữ file này riêng vì chứa dữ liệu tài khoản.

## Source đã dọn

Đã bỏ MSW fixtures/handlers, DevUserSwitcher, public/mockServiceWorker, metadata mẫu, seed mẫu/mật khẩu chung, test Hello World và module trống từ đợt rà đầu. Đã bỏ Gifts module/API/models; thay DTO/API/trang check-in bằng contributions; bỏ wizard chuyển kỳ cũ và danh sách dự án mẫu trên Task Board. Không xóa migrations lịch sử hoặc test nội bộ của dependencies.

Bản sao khôi phục code cũ nằm ngoài workspace trong TEMP. README/.env.example giữ cấu hình thật; runtime không dùng seed/mock. Không force nâng major dependency để xử lý audit.

## Trước khi triển khai

1. DB local đã migrate và kiểm tra schema diff trống, migrate status up-to-date, 7 trigger realtime. Kiểm tra GET thực trên DB local đạt 5/5. Khi triển khai môi trường khác, sao lưu và áp dụng migrations tương ứng. DB mới/trống dùng migrate deploy; DB đã có schema cần đối chiếu baseline và migrate resolve initial trước deploy. Không chạy initial CREATE TABLE trực tiếp vào DB hiện có.
2. Generate Prisma client, build BE/FE, rồi dùng NODE_ENV=production và JWT_SECRET ít nhất 32 ký tự. Không dùng cấu hình/mật khẩu local của Docker Compose cho DB công khai.
3. Cấu hình HTTPS, CORS_ORIGINS, VITE_API_BASE_URL hoặc proxy cùng origin, form tuyển dụng và URL Bevy thật.
4. Reverse proxy /api/live/stream phải tắt buffering, cho kết nối SSE dài và heartbeat 25 giây. Mỗi backend instance giữ một kết nối PostgreSQL LISTEN riêng; không dùng transaction pooler cho kết nối LISTEN.
5. Giữ generated Prisma client khi đóng gói runtime; không generate lại bằng dependency chưa cài. Với bản runtime đã build, prune tooling bằng npm prune --omit=dev --omit=optional --ignore-scripts.

Migration DB local đã được người dùng phê duyệt và hoàn tất. Không chạy sửa mật khẩu hoặc tạo dữ liệu kiểm thử trên DB CLB. Kiểm tra đọc API dùng tiến trình riêng, tắt Discord và đã dừng sau khi hoàn tất. Production vẫn cần cấu hình và triển khai riêng.
