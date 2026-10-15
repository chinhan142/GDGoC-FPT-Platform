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

### Bỏ câu hỏi cam kết thời gian

Form hiện không hỏi hoặc gửi `commitment`; bước cuối đổi thành “Hoàn tất”. BE nhận hồ sơ không có trường này. Giá trị cũ vẫn được chấp nhận để các tab form chưa reload và job đã lưu tiếp tục hoạt động; không sửa payload/hash hoặc xóa câu trả lời trong hồ sơ cũ.

**Deploy Code.gs mới trước khi mở form mới cho ứng viên:** copy toàn bộ file → Save → Manage deployments → Edit → New version → Deploy. Vẫn dùng protocol v2, URL `/exec` và các Script Properties cũ. Script cũ chưa cập nhật sẽ từ chối hồ sơ thiếu commitment (`INVALID`); hồ sơ vẫn an toàn trong DB nhưng cần retry đồng bộ sau khi sửa deployment.

Sheet mới dùng **23 cột**, không còn “Mức cam kết”. Với tab cũ, script so khớp đầy đủ 24 header chuẩn rồi **xóa cột P / 16**, giữ các cột và dữ liệu khác. Nếu header không khớp, trả `SCHEMA` và không tự sửa tab. Ba cột kỹ thuật sau chuyển đổi nằm ở **U–W / 21–23**, luôn được ẩn; cột P mới là “Lời nhắn”. Không cần migration DB hoặc đổi/xóa payload/hash hồ sơ đã lưu.

Sau khi **Deploy New version**, chọn hàm **`migrateRecruitmentSheet` → Run** trong Apps Script để chuyển tab trong `SHEET_NAME` ngay, cấp quyền Google nếu được hỏi. Chạy lại hàm không xóa thêm cột. Nếu không chạy thủ công, lần đồng bộ hợp lệ đầu tiên (kể cả retry) cũng tự chuyển đổi. Không xóa cột khác hoặc sửa header bằng tay.

1. Copy toàn bộ `Code.gs` mới vào Apps Script.
2. Script Properties: `SPREADSHEET_ID` là ID Sheet; `WEBHOOK_SECRET` bằng secret BE; `SHEET_NAME` giữ tab đang dùng (ví dụ `Ung vien tu Web V2`). Tab chuẩn cũ 24 cột tự chuyển thành 23 cột như hướng dẫn trên. Không tự đổi header hoặc xóa ba cột kỹ thuật ẩn.
3. Save → Deploy → Manage deployments → Edit → New version → Deploy. Execute as Me, access Anyone. Nếu tạo deployment mới, cập nhật URL /exec ở BE.
4. Mở URL /exec phải trả `protocol: gdgoc-recruitment-v2`, `sheetColumns: 23`. Đây là thông tin bản code, không tự sửa Sheet khi GET. Worker không POST vào script v1 để tránh cấp sai mã UV. `RECRUITMENT_CYCLE` Script Property cũ có thể giữ nhưng v2 dùng cycle trong payload đã ký, để đồng bộ cả các hồ sơ chờ của đợt cũ.

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
