# Gửi mail reset mật khẩu bằng Gmail SMTP

Backend dùng Nodemailer với Gmail CLB. Không cần domain riêng để gửi mail; địa chỉ người gửi là Gmail được cấu hình. Luồng reset và token trong DB không thay đổi khi website có domain sau này.

1. Bật 2-Step Verification cho Gmail gửi mail.
2. Tạo App Password tại https://myaccount.google.com/apppasswords.
3. Điền vào `.env` local hoặc secret/environment của backend hosting:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-club-email@gmail.com
SMTP_PASS=<Google App Password>
SMTP_FROM="GDGoC FPTU HCMC <your-club-email@gmail.com>"
APP_FRONTEND_URL=https://your-frontend-domain
```

Port 465 dùng TLS ngay khi kết nối; port 587 cũng được hỗ trợ và bắt buộc STARTTLS. Dùng App Password, không dùng mật khẩu Gmail thông thường. Backend chấp nhận App Password có khoảng trắng theo cách Google hiển thị. Khi đổi mật khẩu Google, App Password bị thu hồi và cần tạo lại.

`SMTP_FROM` dùng cùng Gmail với `SMTP_USER`. `APP_FRONTEND_URL` local có thể là `http://localhost:3000`; khi deploy phải đổi sang URL frontend thực tế và restart backend sau khi cập nhật cấu hình. Không đưa credential vào FE, Git hoặc log.

Link reset không còn được log ra console. Thiếu SMTP hoặc lỗi gửi trả trạng thái thất bại nội bộ; token của yêu cầu gửi thất bại được xóa có điều kiện, không xóa token của yêu cầu mới hơn. API quên mật khẩu vẫn trả cùng thông báo cho tài khoản tồn tại và không tồn tại để tránh dò danh sách thành viên.

Kiểm tra kết nối SMTP chỉ xác nhận kết nối/TLS/xác thực, không bảo đảm thư đã đến inbox. Sau đó thử quên mật khẩu bằng tài khoản của tester, kiểm tra inbox/spam và link về đúng frontend. Không dùng mail reset để gửi hàng loạt thông báo tuyển sinh.

Tài liệu: [Google App Passwords](https://support.google.com/accounts/answer/185833), [Giới hạn Gmail](https://support.google.com/mail/answer/22839).
