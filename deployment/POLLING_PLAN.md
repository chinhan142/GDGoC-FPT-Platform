# Kế hoạch thay SSE bằng polling — 15/10/2026

Trạng thái: đề xuất dựa trên code hiện tại; chưa sửa FE/BE hoặc chạy migration.

## Mục tiêu và phạm vi

Khoảng 30 thành viên, tối đa khoảng 30 hồ sơ/đợt. Giữ cập nhật tự động cho task, sự kiện, Gems, thông báo, dashboard và kỳ hoạt động, không cần reload trang. Chấp nhận dữ liệu từ người khác cập nhật chậm khoảng 30 giây khi tab hoạt động và API/mạng bình thường. Thao tác của chính người dùng vẫn cập nhật ngay sau API thành công.

Tắt kết nối SSE dài để phù hợp Cloud Run request-based min=0. Việc này không bảo đảm hóa đơn bằng 0 và không loại bỏ cold start. Đồng bộ Sheet bằng queue là công việc riêng, không được thay bằng timer polling ở trình duyệt.

## Hiện trạng đã xác minh

- FE `src/components/LiveUpdates.tsx` tạo EventSource `/api/live/stream`. Mỗi refresh gọi generation config, phát `gdgoc:refresh` và lấy tới 100 thông báo. Có refresh ở cả lần mount và onopen.
- TaskBoard, EventManagement, GemsLeaderboard, DashboardOverview đều nghe sự kiện chung nên thay đổi không liên quan cũng có thể tải lại dữ liệu trang.
- BE `src/modules/realtime/realtime.module.ts` giữ một Pool riêng cho LISTEN gdgoc_updates, stream heartbeat 25 giây. AppModule import RealtimeModule.
- Migration business_rules dùng trigger statement trên tasks, assignees, events, contributions, gems_transactions, notifications, semesters. Trigger hiện phát cùng danh sách resource cho mọi thay đổi, không có trạng thái bền để client truy vấn sau khi server restart.

## Thiết kế đề xuất

### 1. Backend trả dấu phiên bản dữ liệu

Thêm endpoint authenticated `GET /api/sync/status`, trả map revision theo nhóm resource, không trả danh sách task/hồ sơ/thông tin của người khác. Có thêm fingerprint membership/kỳ hiện tại từ context đã xác thực để FE nhận biết đổi vai trò/ban/trạng thái. Vẫn áp dụng JwtAuthGuard và mustChangePassword.

Dấu phiên bản lưu trong bảng nhỏ `sync_revisions` trong PostgreSQL, không lưu ở RAM. Mỗi nhóm có revision dạng opaque UUID; cập nhật cùng transaction với thay đổi dữ liệu thông qua trigger. Tránh cơ chế chỉ dùng updatedAt/max(timestamp), vì xóa bản ghi hoặc đồng thời cập nhật có thể bị bỏ sót.

Lượt kiểm tra chỉ đọc các dòng revision nhỏ, không quét toàn bộ bảng nghiệp vụ. Revision lúc đầu có thể dùng chung toàn hệ thống cho từng resource để đơn giản: có thể refresh dư khi ban khác sửa, nhưng không trả payload, tên, ID hoặc số lượng dữ liệu ngoài quyền. API lấy dữ liệu gốc tiếp tục kiểm tra RBAC/Alumni/phạm vi ban. Không trả revision riêng của resource mà tài khoản không được truy cập.

Đăng ký phụ thuộc dữ liệu:

| Nhóm thay đổi | Dữ liệu cần làm mới |
| --- | --- |
| Tasks và task_assignees | Task board, dashboard, daily summary |
| Events và contributions | Trang sự kiện, dashboard |
| Gems transactions/số dư | BXH, ledger, số dư hồ sơ và dashboard |
| Notifications và notification_reads | Badge, danh sách thông báo; đồng bộ đọc giữa thiết bị |
| Semesters và tenures | Config kỳ; invalidation các dữ liệu phụ thuộc kỳ |
| Membership/profile cần thiết | Refresh session/identity, quyền hiển thị, hồ sơ tương ứng |

Theo dõi users/user_tenures có chọn lọc trường nghiệp vụ; cập nhật token reset/sessionVersion không phát tín hiệu thay đổi hồ sơ toàn CLB. Thay đổi sessionVersion vẫn được JwtStrategy kiểm tra mỗi request.

Trigger mới chỉ cập nhật đúng nhóm và luôn có thứ tự lock nhất quán khi đụng nhiều revision để tránh deadlock; kiểm thử concurrent mutation và rollback. Bật RLS/thu hồi quyền PUBLIC, anon, authenticated trên bảng revision; FE chỉ đọc qua API.

Không dùng pg_notify/listener cho luồng mới. Không sửa migration đã chạy: viết migration mới để chuyển trigger và bỏ các trigger/function SSE cũ đúng tên sau giai đoạn chuyển đổi. Schema hệ thống Supabase auth/storage giữ nguyên.

### 2. Frontend một bộ polling dùng chung

Thay LiveUpdates bằng PollingUpdates hoặc hook dùng ở DashboardLayout:

- Chỉ chạy khi đăng nhập, đã đổi mật khẩu lần đầu và ở khu vực nội bộ. Landing page/form tuyển không polling.
- Kiểm tra ngay khi vào khu vực nội bộ; dùng lần đầu làm baseline đồng thời phối hợp dữ liệu trang để tránh bỏ thay đổi trong lúc initial fetch.
- Sau mỗi lượt hoàn tất, chờ khoảng 30 giây rồi kiểm tra tiếp; thêm jitter nhỏ tránh nhiều trình duyệt cùng gọi một nhịp. Dùng setTimeout nối tiếp, không setInterval tạo request chồng.
- Tab hidden hoặc offline: hủy request đang chờ, dừng lịch. Khi visible/online: kiểm tra lại ngay; debounce các event focus/visibility/online để không gọi lặp.
- Chống mount/unmount và React StrictMode tạo hai vòng polling. AbortController + user generation token ngăn response cũ cập nhật state sau logout/đổi tài khoản.
- Một request status chung cho mỗi tab hiển thị, không tạo timer riêng ở mỗi trang. Giai đoạn đầu chưa cần leader election đa tab; tab ẩn không polling, nhiều cửa sổ cùng hiển thị vẫn có thể tạo nhiều request.
- Không đổi revision thì không gọi lại API dữ liệu. Nếu cần tải lại, chỉ trang đang mount và các store chung liên quan mới fetch. Giữ state cũ, không nháy spinner toàn trang.
- Resource nào fetch thất bại thì giữ dirty và thử lại; không coi là đã đồng bộ chỉ vì đã nhận revision mới. Nếu có mutation trong khi đang fetch, không để response cũ ghi đè kết quả mới.
- Nhận tín hiệu membership/kỳ thay đổi: refresh session/config trước rồi mới tải dữ liệu dưới quyền/phạm vi mới; không gọi fetchSession có loading toàn trang mỗi 30 giây.
- Không reset bộ lọc, kỳ đang xem, phân trang Gems, vị trí scroll hoặc nội dung form/draft. Nếu bản ghi đang sửa bị đổi/xóa, hiển thị thông báo phù hợp thay vì tự ghi đè draft.

Thay sự kiện gdgoc:refresh chung bằng invalidation có resource; sửa tất cả listener tại 4 trang đã xác minh. Profile Gems và daily summary cũng cập nhật đúng phụ thuộc. Việc tạo/sửa/duyệt/xóa ở tab hiện tại vẫn cập nhật state ngay, không đợi tick polling.

### 3. Lỗi và phiên đăng nhập

- Timeout hữu hạn, phân biệt cold start với lỗi xác thực, không xóa session vì timeout/lỗi mạng.
- Lỗi tạm thời/5xx: backoff khoảng 30 → 60 → 120 giây, tối đa 5 phút. Sau thành công trở lại lịch thường.
- 429: tôn trọng Retry-After nếu có, không retry dồn.
- 401: hủy polling và xóa state của tài khoản cũ, đưa về login một lần. 403 do first-password/membership phải xử lý theo trạng thái và dừng vòng lỗi; không tự coi mọi 403 là logout.
- Không toast lỗi mỗi lần poll; giữ dữ liệu cũ và trạng thái kết nối nhẹ. Không báo «cập nhật trực tiếp» theo nghĩa tức thì: đổi thành «Tự cập nhật khoảng 30 giây».

## Triển khai theo thứ tự

1. Viết migration additive cho revision + trigger; triển khai trên local, kiểm tra RLS/rollback/concurrency.
2. Thêm endpoint status và contract, kiểm tra số query/payload, quyền truy cập. Có thể giữ SSE cũ tạm thời trong giai đoạn chuyển để FE cũ còn hoạt động; không giữ cả hai transport trên cùng client.
3. Chuyển FE sang polling, làm resource invalidation và pause/backoff. Kiểm tra trên local rồi build.
4. Áp dụng migration/add endpoint lên cloud trước, sau đó deploy FE polling. Client ở lần tải bundle mới sẽ dùng polling; lên lịch đóng transport cũ để ngắt các tab bundle cũ, chúng cần tải lại một lần.
5. Bỏ EventSource, endpoint /api/live/stream, heartbeat, LISTEN pool và phần trigger/function SSE còn lại qua migration cleanup. Soát source không còn giữ kết nối dài.
6. Đo request count, latency, DB query duration, Cloud Run billable time. Tinh chỉnh chu kỳ sau khi có số liệu, không dùng request count đơn lẻ để cam kết free tier.

Rollback: trước cleanup, có thể trả lại bundle SSE cũ cùng backend tương thích. Sau cleanup phải có migration khôi phục transport/trigger tương ứng nếu thật sự quay lại; không chỉ bật một cờ khi các thành phần đã bị xóa. Không reset DB hoặc sửa dữ liệu nghiệp vụ để rollback.

## Kiểm thử nghiệm thu

- BĐH giao task cho thành viên khác: task, thông báo và daily summary xuất hiện trong khoảng một chu kỳ khi tab visible, không reload.
- Đổi trạng thái/xóa task; thêm/xóa sự kiện và contributor; thưởng/hoàn Gems; chuyển kỳ: chỉ nhóm liên quan được refetch và số liệu khớp DB.
- Đồng bộ cả thao tác xóa; transaction rollback không đổi revision. Các BE instance khác nhau/restart vẫn trả revision nhất quán.
- Mark read ở thiết bị A thì thiết bị B cập nhật sau tick. Thông báo riêng/ban khác không lộ payload qua status.
- MEMBER/DEPARTMENT_LEAD/Lv1/Alumni giữ đúng quyền. Đổi role/ban/trạng thái trong lúc đang mở trang và reset mật khẩu từ thiết bị khác được xử lý.
- Giữ tab hidden 5 phút không tạo polling mới; quay lại fetch một lượt. Offline/reconnect/backoff/429 không có request chồng hoặc toast liên tục.
- Không ghi đè draft, không reset filter/kỳ/phân trang/scroll; resource fetch lỗi không mất dirty state.
- Không còn EventSource, heartbeat hay LISTEN pool khi hoàn tất cleanup. Tests và fixture local vẫn ignore theo quy ước; migration/tài liệu ở deployment được commit khi triển khai.

## Ngoài phạm vi

Chưa triển khai Cloud Tasks, proxy Cloudflare /api, Docker/Cloud Run hoặc đổi auth provider trong đợt chuyển polling. Chúng cần kế hoạch/deploy riêng. Nhân sự, vật tư và Drive chưa được SSE hiện tại cập nhật đầy đủ; không tự mở rộng toàn bộ ba module trong đợt này. Các tín hiệu membership cần thiết để bảo đảm quyền/session được xét trong phạm vi polling.
