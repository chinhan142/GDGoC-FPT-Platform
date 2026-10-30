# Tuyển thành viên: DB trước, Google Sheet đồng bộ nền

FE gửi `POST /api/recruitment/applications`. BE validate DTO, nguyện vọng, kỹ năng, consent, honeypot và giới hạn IP; sau đó lưu hồ sơ vào `recruitment_applications` trong PostgreSQL. Chỉ trả mã UV khi DB đã lưu. Không chờ Google, không tự tạo tài khoản nội bộ, không gửi email chấp nhận.

## Cập nhật DB và backend

Trong `BE/backend`, cấu hình `DATABASE_URL` đúng DB đích rồi chạy:

```sh
npx prisma migrate deploy
npx prisma generate
npm run build
```

Restart BE sau khi generate client/migration. Migration chỉ thêm enum, sequence và bảng recruitment; không xóa dữ liệu cũ. RLS bật, không cấp quyền đọc cho anon/authenticated; backend dùng tài khoản PostgreSQL riêng có quyền ghi. Không dùng Prisma db push để thay migration.

```dotenv
RECRUITMENT_OPEN=true
RECRUITMENT_CYCLE=Gen 4.0 - Fall 2026
RECRUITMENT_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
RECRUITMENT_WEBHOOK_SECRET=<random secret, tối thiểu 32 ký tự>
```

Status chỉ phụ thuộc mở tuyển và nhãn đợt tuyển; Google hỏng vẫn nhận hồ sơ vào DB. DB hỏng không báo thành công. Đóng tuyển chặn hồ sơ mới nhưng worker vẫn đồng bộ hồ sơ đã nhận. BE giữ snapshot đợt tuyển trong payload. Cùng requestId + cùng nội dung trả mã cũ; thay nội dung bị conflict. DB unique theo email/MSSV chuẩn hóa trong cùng đợt tuyển ngăn concurrent duplicate.

Mã DB mới bắt đầu `UV1000001` để tách khỏi mã UV nhỏ từng tạo trong Sheet cũ. Không tạo lại mã UV001. Sheet dùng chính mã DB, không tự cấp mã. Hồ sơ cũ trên Sheet được giữ nguyên và chưa tự import vào DB; kiểm tra/trích xuất để backfill trước khi mở tuyển production nếu cần chống trùng cả dữ liệu cũ. Nếu bị trùng với hồ sơ cũ trên Sheet, bản DB vẫn an toàn và trạng thái FAILED/DUPLICATE để BCN xử lý.

## Cập nhật Apps Script

### Câu hỏi cuối form theo ban NV1

Bước “Hoàn tất” yêu cầu thêm câu trả lời 10–5.000 ký tự:

- AI, Cloud, Web Development, Research (Khối Tech): “Một sản phẩm công nghệ hoặc tính năng AI nào gần đây khiến bạn cảm thấy ấn tượng nhất, và điều gì ở nó làm bạn thích thú?”
- Media, HR & Event (Khối Community & Events): “Một chiến dịch truyền thông hoặc một sự kiện/hoạt động nào của trường FPTU hoặc một thương hiệu mà bạn thấy ấn tượng nhất gần đây? Bạn thích điều gì ở cách họ làm?”

Chỉ hiện một câu theo NV1, không theo NV2. Khi đổi NV1 sang khối khác (Tech vs Community & Events), câu trả lời cũ được xóa để ứng viên trả lời đúng câu mới. Không hiển thị mục đích đánh giá nội bộ cho ứng viên.

Câu trả lời được lưu trong trường `inspiration` của JSON payload trong DB, sau đó đồng bộ vào **cột P / 16 — “Điều ấn tượng gần đây (theo ban NV1)”**, ngay sau “Mục tiêu gia nhập”. “Lời nhắn” ở Q / 17; ba cột kỹ thuật V–X / 22–24 tiếp tục ẩn. Không cần migration DB. BE và script vẫn nhận hồ sơ cũ thiếu trường này để form đã mở và job tồn đọng tiếp tục hoạt động; không thay payload/hash cũ.

Form không còn câu hỏi cam kết thời gian. Script tự chuyển tab chuẩn 24 cột cũ có “Mức cam kết” bằng cách xóa cột P / 16; tab chuẩn 23 cột sẽ được chèn câu trả lời ở P. Bản 24 cột từng đặt câu trả lời ở X sẽ được chuyển nguyên cột về P, giữ câu trả lời và các ô review khác. Tab đã chuyển đúng thứ tự mới được giữ nguyên. Dữ liệu khác và khóa chống trùng giữ nguyên. Nếu header không khớp hoặc có header riêng ở vị trí cần chuyển đổi, trả SCHEMA; không tự ghi đè cấu trúc lạ.

1. Copy **toàn bộ Code.gs mới** vào Apps Script và Save.
2. Giữ các Script Properties: SPREADSHEET_ID, WEBHOOK_SECRET khớp BE, SHEET_NAME trỏ đúng tab hiện có. Không tự thêm/xóa cột hoặc đổi header.
3. Deploy → Manage deployments → Edit → **New version** → Deploy. Execute as Me, access Anyone. Nên sửa deployment đang dùng để giữ URL; nếu tạo deployment mới phải đổi RECRUITMENT_APPS_SCRIPT_URL trong BE/backend/.env và restart BE.
4. Mở URL /exec phải trả protocol gdgoc-recruitment-v2 và **sheetColumns: 24**, **sheetLayout: inspiration-after-goals**. GET chỉ kiểm tra phiên bản, không thay Sheet.
5. Chọn hàm **migrateRecruitmentSheet → Run** trong editor để cập nhật cột ngay. Chạy lại an toàn; nếu không chạy thủ công, lần đồng bộ hợp lệ đầu tiên cũng tự nâng cấu trúc.
6. Restart BE sau khi cập nhật code/env, deploy lại FE. Hồ sơ FAILED từ deployment cũ cần retry qua API quản trị sau khi sửa URL/script; không cần ứng viên nộp lại.

Script giữ HMAC, validation, lock, idempotency theo requestId/hash, chống email/MSSV trùng theo cycle và flush trước success. Retry sau khi Sheet ghi mà BE mất phản hồi trả mã cũ, không thêm dòng. Dữ liệu có thể là công thức được lưu dạng text; SĐT giữ số 0 đầu.

## Trạng thái đồng bộ và review

| Cột | Ý nghĩa |
| --- | --- |
| `syncStatus` | PENDING: chờ; PROCESSING: đang gửi; SYNCED: Sheet xác nhận đúng mã; FAILED: cần xử lý |
| `syncAttempts` | Số lần worker đã nhận xử lý |
| `syncError` | Mã lỗi an toàn, không lưu nội dung lỗi upstream hoặc secret |
| `nextSyncAt` | Thời điểm thử lại sớm nhất |
| `syncedAt` | Thời điểm xác nhận đồng bộ thành công |
| `payload` | Hồ sơ gốc đã validate và snapshot đợt tuyển |

Lv1 đang hoạt động (LEAD/ADVISOR/ADMIN) có API:

- `GET /api/recruitment/applications`: 100 hồ sơ mới nhất, bao gồm trạng thái và payload; cần đăng nhập, chưa có màn hình FE quản trị riêng.
- `POST /api/recruitment/applications/:id/retry-sync`: đưa hồ sơ FAILED về PENDING, reset số lần thử. Không cho sửa hồ sơ hoặc retry hồ sơ đang xử lý qua endpoint này.

Cũng có thể review bảng trong Supabase dashboard bằng tài khoản quản trị. Kết quả chấm/review nhập trên Sheet chưa đồng bộ ngược về DB.

Worker quét mỗi 5 giây, xử lý tối đa 5 hồ sơ mỗi lượt. Atomic claim `FOR UPDATE SKIP LOCKED` và lease 2 phút tránh hai instance xử lý cùng một job. Token lease ngăn worker cũ ghi đè worker mới. BE restart/kill giữa chừng được lấy lại sau khi hết lease. Lỗi mạng/HTTP/BUSY/UNAVAILABLE thử lại sau 1, 2, 4… tối đa 30 phút; sau 10 lần chuyển FAILED. CONFIG/PROTOCOL/UNAUTHORIZED/SCHEMA/INVALID/CONFLICT/DUPLICATE chuyển FAILED để người quản trị sửa nguyên nhân rồi retry. Không mất hồ sơ khi Sheet lỗi.

**Hosting:** timer nền cần BE đang chạy và được cấp CPU. Cloud Run với request-based CPU hoặc scale-to-zero không bảo đảm worker tiếp tục chạy sau response. Muốn đồng bộ ổn định trên cấu hình đó cần scheduler/queue riêng hoặc instance luôn chạy với CPU nền; bản hiện tại chưa tích hợp Cloud Tasks/Scheduler. Job vẫn bền trong DB khi BE tắt, nhưng chỉ tiếp tục khi worker chạy lại.

Giới hạn IP 10 request/10 phút theo process, chưa phải distributed rate limiter. Khi mở tuyển công khai thêm ingress rate limit. Không lưu draft hồ sơ vào localStorage; retry giữ requestId nếu dữ liệu không đổi.

## Kiểm thử

Trong repo root sau build BE:

```sh
node BE/testing/recruitment.test.cjs
node BE/testing/recruitment-outbox.test.cjs
```

Kiểm tra PostgreSQL thật (chỉ DB local dành cho dev): `node BE/testing/recruitment-db.test.cjs`. Tạo fixture riêng rồi xóa, không POST Google; sequence có thể tăng vì counter PostgreSQL không rollback. Không chạy vào DB production.

Tests local bị ignore theo quy ước project. Kiểm tra DB down không success; Google down vẫn nhận DB; retry không trùng; NV2/consent/skills sai trả lỗi trước DB; worker mạng lỗi/restart/concurrent claim; deploy v1 bị chặn; v2 trả đúng mã mới SYNCED. Không tạo hồ sơ giả trên Sheet production để đo tốc độ.

Tài liệu Google: [Web apps](https://developers.google.com/apps-script/guides/web), [ContentService redirects](https://developers.google.com/apps-script/guides/content), [LockService](https://developers.google.com/apps-script/reference/lock/).
