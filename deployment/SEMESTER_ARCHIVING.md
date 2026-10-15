# Lưu trữ theo kỳ học

- Kỳ học (Spring/Summer/Fall) là đơn vị chốt task và Gems, tách biệt nhiệm kỳ.
- Chốt kỳ giữ nguyên task, minh chứng, trạng thái, sự kiện và ledger Gems trong DB. Task chưa xong vẫn được lưu, không tự thành DONE, không cộng điểm hoặc sao chép sang kỳ mới.
- Kỳ mới có bảng task trống và tổng Gems của kỳ bằng 0. Số dư tích lũy/lịch sử, tài khoản, nhân sự, vật tư và tài liệu được giữ nguyên.
- BCN/Lv1 xem task kỳ cũ bằng bộ chọn **Xem kỳ** ở bảng công việc. Kỳ cũ chỉ đọc và hiển thị toàn bộ task Done, không áp dụng bộ lọc 14 ngày. Gems có bộ chọn kỳ riêng; cấu hình niên khóa có tổng kết kỳ đã chốt.
- Không còn chức năng xóa task ở FE hoặc `DELETE /api/tasks/:id` ở BE. Không xóa task để dọn bảng; dùng chuyển kỳ học.
- Đóng góp sự kiện chưa cộng Gems phải xử lý trước khi chốt. Sự kiện kỳ đã chốt không được xóa/đổi người đóng góp để tránh thay đổi điểm lịch sử.
- Chuyển nhiệm kỳ bổ sung việc lưu trữ nhiệm kỳ cũ và sao chép nhân sự sang nhiệm kỳ mới để BCN cấu hình lại. Task và giao dịch không được sao chép.

Không chạy chuyển kỳ thật để test trên DB đang sử dụng. Kiểm thử dùng fixture trong transaction rollback; không reset hay xóa dữ liệu CLB. Thay đổi này không cần migration schema mới.
