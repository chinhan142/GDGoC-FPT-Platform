# 📜 GDGoC Platform — Quy Tắc & Quy Trình Phát Triển Bắt Buộc (Mandatory Dev Rules)
**Dành cho:** Web Lead & AI Assistant  
**Phạm vi áp dụng:** Toàn bộ các Sprint phát triển của dự án GDGoC Portal.

---

## 🔒 1. Quy Tắc Bảo Mật Bắt Buộc (Security Mandates)
1. **Không bao giờ hardcode biến môi trường**: Tất cả thông tin nhạy cảm (JWT Secret, Database URLs, Webhook Keys, Private Keys, Service Account) phải được đọc từ `process.env` hoặc `ConfigService`.
2. **Ẩn thông tin nhạy cảm**: Không in token, mật khẩu hoặc private keys ra log/console hoặc commit lên Git.
3. **Cookie Security**: Luôn dùng HttpOnly Cookie, SameSite=Lax và cờ Secure (khi ở Production).

---

## 📋 2. Quy Trình 3 Tài Liệu Cho Mỗi Sprint (Mandatory 3 Artifacts Per Sprint)

Mỗi Sprint bắt buộc phải tạo và lưu trữ **đủ 3 tệp tài liệu** vào thư mục: `D:\GDG-Management-Internal Docs\` theo đúng quy ước đặt tên:

### 1️⃣ `Implementation_Plan_Sprint_xx.md` (Tạo TRƯỚC khi code)
- Trình bày chi tiết những gì dự định làm, kiến trúc kỹ thuật sẽ sử dụng, các DTOs, endpoint sẽ tạo.
- Nêu rõ cam kết bảo mật (không hardcode env).
- Định rõ các bước kiểm thử (Verification Plan).

### 2️⃣ `Walkthrough_Sprint_xx.md` (Tạo SAU khi code xong)
- Ghi lại nhật ký toàn bộ tệp đã tạo/chỉnh sửa.
- Giải thích cặn kẽ luồng đi nghiệp vụ (Business Logic Flow), kiến trúc (Architecture) kèm sơ đồ.
- **Đính kèm tài liệu tham khảo chính thống** (Official Docs từ NestJS, Prisma, OWASP, MDN, RFC...) có cơ sở thực tế, không bịa đặt, không dẫn link cũ.

### 3️⃣ `Review_Guide_Sprint_xx.md` (Tạo SAU khi code xong)
- Hướng dẫn Web Lead rà soát code (Code Review Guide) theo thứ tự logic từng bước từ dưới lên (Database ➔ Interceptor ➔ Service ➔ Controller).
- Chỉ rõ từng điểm kỹ thuật & nghiệp vụ cần soi kỹ.
- Cung cấp kịch bản test thực tế nhanh gọn để Web Lead chủ động kiểm tra và nghiệm thu.
