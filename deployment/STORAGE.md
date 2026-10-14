# Avatar và ảnh bìa trên Supabase Storage

## Cấu hình backend

Trong Supabase Dashboard → Project Settings → API Keys, lấy **Secret key** dạng `sb_secret_...`. Key này khác mật khẩu PostgreSQL; giữ tại backend, không đưa vào FE hoặc biến `VITE_*`.

```dotenv
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_STORAGE_BUCKET=profile-images
```

Tại Storage, tạo bucket `profile-images` **public**, giới hạn file **5 MB**, chỉ cho MIME `image/jpeg`, `image/png`, `image/webp`. Bucket public phục vụ ảnh avatar/bìa công khai; không lưu tài liệu nội bộ vào bucket này. Không thêm policy upload/delete cho `anon` hoặc `authenticated`: backend xác thực tài khoản bằng hệ thống đăng nhập hiện tại và dùng Secret key để thao tác Storage. Khi deploy, cấp lại ba biến cho process backend.

## Luồng sử dụng

FE tiếp tục gửi multipart `file` đến `POST /api/members/me/images/avatar` hoặc `/cover`. Backend kiểm tra chủ tài khoản, trạng thái hoạt động, kích thước và chữ ký định dạng, upload file vào `profiles/<userId>/<kind>-<uuid>.<extension>`, rồi lưu URL vào `users.avatarUrl` hoặc `users.coverUrl`. API vẫn trả `{ url, kind }`; không cần đổi FE hoặc dùng Supabase Auth.

Bấm avatar hoặc vùng ảnh bìa để chọn ảnh. Upload lưu ngay; reload vẫn giữ ảnh. Tài khoản chưa đổi mật khẩu lần đầu phải đổi trước, Alumni/tạm nghỉ không được upload. Nếu upload thất bại, URL cũ trong DB giữ nguyên. Nếu lưu DB thất bại sau upload, backend thử xóa đúng object mới tạo.

Ảnh có tên riêng cho mỗi lần upload, tránh ghi đè/cache ảnh cũ. Ảnh đã thay không tự xóa để tránh ảnh hưởng link đang dùng; theo dõi quota và dọn object không còn được tham chiếu. Chưa có crop hoặc tự động resize. URL ảnh cũ từ dịch vụ khác vẫn hiển thị đến khi thành viên thay ảnh.

## Kiểm tra

Build và restart backend sau khi điền Secret key. Upload avatar/bìa thật, reload, kiểm tra URL thuộc project Supabase và object có trong bucket. Kiểm tra file quá 5 MB, SVG/file giả ảnh, Alumni và tài khoản chưa đổi mật khẩu bị từ chối. Không log Secret key hoặc header `apikey`.

Tài liệu: [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads).
