# Hồ sơ thành viên nội bộ

- `GET /api/members/:id/profile` yêu cầu đăng nhập và có membership CLB; tài khoản buộc đổi mật khẩu vẫn bị JwtAuthGuard chặn như các API khác.
- Bấm tên/avatar tại task, nhân sự, BXH/Gems hoặc danh sách đóng góp sự kiện để mở `/app/members/:id`. Không tạo danh bạ mới. Bấm chính mình chuyển về Hồ sơ của tôi.
- Hồ sơ người khác chỉ đọc: ảnh đại diện/bìa, tên, ban/chức danh, trạng thái, bio, kỹ năng, liên kết xã hội và vai trò qua các nhiệm kỳ.
- Email, SĐT, MSSV chỉ trả cho chủ tài khoản hoặc Lv1 đang hoạt động. Đây là quy tắc cố định, không có cài đặt chia sẻ. Không nới API danh sách nhân sự hoặc quyền đọc task/tài liệu.
- Không trả password hash, token, sessionVersion hoặc trạng thái mật khẩu trong DTO. Chỉ chọn rõ các cột cần dùng trong truy vấn.
- Lịch sử dùng `user_tenures`, sắp nhiệm kỳ mới trước; không dựng lịch sử từ role hiện tại và không coi kỳ học là nhiệm kỳ. Đây là vai trò được lưu cho mỗi nhiệm kỳ, không phải nhật ký mọi lần đổi chức danh trong cùng nhiệm kỳ.
- Hồ sơ của tôi có thêm lịch sử vai trò. Quyền sửa hồ sơ cá nhân và quyền chỉ đọc Alumni giữ nguyên.
- Chưa bổ sung thống kê theo kỳ hay mở task/minh chứng của người khác. Không cần migration schema.
