# Avatar và ảnh bìa qua Cloudinary

## Cấu hình

1. Tạo tài khoản Cloudinary, chọn product environment dùng cho ứng dụng. Trong Console → Settings → API Keys, lấy **Cloud name**, **API key**, **API secret**. Nên tách environment staging và production.
2. Thêm vào `BE/backend/.env` khi chạy local, hoặc Environment Variables của dịch vụ backend khi deploy:

```dotenv
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Không commit `.env`, không đưa API secret vào FE hoặc biến `VITE_*`. Không cần tạo unsigned upload preset: backend gọi API upload có xác thực bằng Basic Auth qua HTTPS. Xem [Cloudinary upload documentation](https://cloudinary.com/documentation/upload_images).

3. Trong thư mục `BE/backend`, chạy:

```powershell
npm run prisma:generate
npm run db:migrate
npm run build
npm run start:dev
```

Production dùng `npm run start:prod` thay cho `start:dev`; chạy migration trước khi khởi động phiên bản mới. Migration profile thêm cột nullable `users.coverUrl`. Hãy áp dụng đầy đủ các migration hiện có, bao gồm Gems actor; không reset DB hoặc mật khẩu.

4. Trong thư mục `FE`, chạy `npm run dev` để thử local. Khi deploy, build FE và giữ proxy `/api` hoặc `VITE_API_BASE_URL` theo cấu hình đăng nhập đang dùng; không cần biến Cloudinary trên FE. Nếu proxy có giới hạn request body, đặt tối thiểu 6 MB để nhận file 5 MB cùng multipart headers.

## Cách sử dụng và luồng lưu

- Bấm trực tiếp vào avatar hoặc vùng ảnh bìa, chọn JPG/PNG/WebP tối đa 5 MB. Có thể dùng Tab rồi Enter/Space để mở bộ chọn file.
- Ảnh được upload và lưu ngay sau khi chọn; không cần bấm **Lưu Thay Đổi Hồ Sơ**. Nút này vẫn dùng cho Bio, SĐT, skills và mạng xã hội.
- FE gửi multipart `file` đến `POST /api/members/me/images/avatar` hoặc `/cover`, kèm cookie đăng nhập.
- BE kiểm tra quyền, kích thước và chữ ký định dạng file; upload Cloudinary với public ID `gdgoc/profiles/<userId>/<kind>-<uuid>`; sau khi thành công mới cập nhật `users.avatarUrl` hoặc `users.coverUrl`. FE nhận URL HTTPS và cập nhật giao diện.
- Alumni và người tạm nghỉ không có nút upload; BE cũng từ chối upload. Tài khoản chưa đổi mật khẩu lần đầu phải hoàn thành đổi mật khẩu trước.
- Ảnh bìa localStorage của phiên bản cũ không tự chuyển sang Cloudinary. Chọn lại file để đồng bộ giữa thiết bị. Avatar cũ trong DB vẫn được giữ đến khi thay ảnh.

## Phạm vi hiện tại

Ảnh profile được Cloudinary phục vụ qua URL công khai; không dùng luồng này cho tài liệu riêng tư. Ảnh cũ không bị xóa tự động khi thay ảnh để tránh phá link đang dùng. Nếu upload Cloudinary thành công nhưng DB lỗi, có thể còn ảnh không được tham chiếu; kiểm tra thư mục `gdgoc/profiles` khi dọn quota. Chưa có crop ảnh hay tự động dọn ảnh cũ.

Sau khi cấp biến môi trường, xác minh upload avatar/bìa thật ở staging, reload và kiểm tra trên thiết bị khác trước khi đưa lên production.
