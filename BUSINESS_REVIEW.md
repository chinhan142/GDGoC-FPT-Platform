# Tổng kết nghiệp vụ — bản đã chốt

Cập nhật 11/10/2026. Đây là mô tả bản code mới theo phản hồi của bạn, thay cho bản review trước.

**FE/BE đã build, kiểm thử và áp dụng migration lên DB local sau khi bạn duyệt. Schema DB local khớp Prisma. Chưa triển khai production.**

## 1. Quyền và tài khoản

- Cấp 1: LEAD = ADVISOR = ADMIN, dùng chung quyền quản trị.
- Cấp 2: DEPARTMENT_LEAD; cấp 3: MEMBER. Loại COLLABORATOR khỏi code; migration đổi vai trò cũ này thành MEMBER.
- Cấp 1 quản lý thông tin quản trị nhân sự: ban, vai trò, chức danh, trạng thái, định danh. Hồ sơ cá nhân chỉ chủ tài khoản đang hoạt động sửa.
- Alumni giữ tài khoản, chỉ xem hồ sơ của mình, task/Gems lịch sử, showcase công khai và tài liệu được chia sẻ. Không nhận task hoặc phân công đóng góp mới, không sửa hồ sơ hay quản trị. Tạm nghỉ cũng không tham gia luồng ghi nghiệp vụ.
- Đổi mật khẩu, đăng xuất và đánh dấu thông báo đã đọc vẫn được phép với Alumni.
- Giữ nguyên mật khẩu hiện tại. Khi cờ mustChangePassword bật, API chặn truy cập nghiệp vụ và FE đưa vào màn hình đổi mật khẩu; đổi thành công mới tiếp tục. Mật khẩu mới phải khác mật khẩu cũ và đáp ứng kiểm tra độ mạnh.

## 2. Các chức năng hiện có

| Chức năng | Luồng nghiệp vụ | Quyền / phạm vi |
|---|---|---|
| Công việc | Tạo → bắt đầu → nộp URL minh chứng → duyệt hoặc yêu cầu sửa → cộng Gems trong transaction. Không kéo thẳng sang Done để bỏ qua duyệt. Không tự duyệt nhiệm vụ của mình. | Cấp 1 chỉ giao Trưởng ban; Trưởng ban chỉ giao MEMBER đang hoạt động trong ban mình. Kiểm tra ở cả create, update và assign API. Thành viên/Alumni chỉ đọc task được giao cho mình; Trưởng ban xem ban mình và nhiệm vụ được giao. |
| Sự kiện | CRUD showcase, link Bevy, gán thành viên đã làm việc, ghi vai trò/đóng góp; cấp 1 duyệt cộng mức Gems cố định cho mỗi người. Không còn khách ngoài, check-in, QR, bằng chứng điểm danh hay hai nhóm audience/BTC. | Cấp 1 và Trưởng ban HR_EVENT quản lý sự kiện/gán người. Cấp 1 duyệt Gems. Trong bản này “event lead” tương ứng Trưởng ban HR_EVENT theo mô hình vai trò hiện có. Alumni chỉ xem showcase công khai và đóng góp của chính mình. |
| Nhân sự | CRUD membership trong nhiệm kỳ; nhập Excel; chuyển ban/vai trò/trạng thái. Cựu thành viên không bị xóa tài khoản. | Chỉ cấp 1 chỉnh thông tin quản trị. HR có thể xem danh sách; Trưởng ban có phạm vi đọc ban mình. Alumni tải hồ sơ được giới hạn vào chính tài khoản. |
| Hồ sơ cá nhân | Xem thông tin thật, task cá nhân và số sự kiện có đóng góp; cập nhật bio, SĐT, kỹ năng, MXH, avatar. | Chủ tài khoản đang hoạt động sửa; BCN không sửa hồ sơ cá nhân người khác. Alumni xem và các input bị vô hiệu hóa. |
| Vật tư | Lưu tên, loại, số lượng, người/vị trí đang giữ, ghi chú. Bàn giao cập nhật holderUserId thật; chuyển về tủ CLB xóa ID người giữ. | Cấp 1 quản lý. Không có luồng mượn/trả. Loại “Gift” ở kho vẫn chỉ là vật phẩm tồn kho, không phải chức năng đổi Gems. |
| Gems / BXH | Sổ giao dịch task, đóng góp sự kiện, điều chỉnh thủ công. BXH và lịch sử có bộ chọn kỳ; điểm trong kỳ được cộng từ ledger của kỳ đó. | Không có đổi quà. Không cộng lại một đóng góp đã được thưởng. Không xóa nguồn đóng góp/task đã thưởng để mất dấu đối soát. Số dư tích lũy cũ được giữ, không tự reset hay tạo giao dịch bù giả. |
| Landing CMS | Xuất bản thống kê, Core Team và thông tin/public flag của sự kiện; người xem mở đường dẫn Bevy thật. | Cấp 1 quản trị. Số đóng góp nội bộ không được gọi là số khán giả/check-in. |
| Drive | Danh mục tài liệu DB, tìm kiếm/phân trang, mở URL Google Drive thật theo quyền được chia sẻ. | Alumni xem PUBLIC/INTERNAL_MEMBER; tài liệu hạn chế theo ban/BCN vẫn có kiểm tra API. Quyền truy cập Google Drive thật do Workspace quyết định. Tạo thư mục tự động chưa tích hợp, API trả 501. |
| Thông báo | Giao task lưu thông báo riêng cho người nhận trong cùng transaction. SSE nhận thay đổi qua PostgreSQL LISTEN/NOTIFY sau commit, cập nhật Task Board, Dashboard, Gems và notification center. | Thông báo cá nhân không hiện cho tài khoản khác. Discord tạo thread công việc vẫn giữ; Discord check-in không còn. |

## 3. Kỳ và nhiệm kỳ

Kỳ học là bản ghi riêng trong DB vì task, sự kiện và Gems cần gắn đúng kỳ; chỉ đổi nhãn FE sẽ làm sai BXH và lịch sử.

- Chuyển kỳ: Fall 2026 → Spring 2027 → Summer 2027 → Fall 2027. Giữ nguyên nhân sự/vai trò, chốt dữ liệu kỳ cũ, mở kỳ tiếp theo.
- Chuyển nhiệm kỳ: 2026–2027 → 2027–2028; sao chép toàn bộ membership, kể cả Alumni, giữ trạng thái và vai trò. BCN tự cấu hình lại sau đó. Ngày bắt đầu nhiệm kỳ mới dựa vào mốc bắt đầu nhiệm kỳ hiện tại; kỳ đầu tương ứng mùa đó.
- Màn hình chỉ có hai nút chuyển và xác nhận thao tác; bỏ wizard và lựa chọn chỉ sao chép Core Team.
- **Quy tắc hiện đang áp dụng: chặn chốt kỳ nếu còn task chưa Done hoặc đóng góp chưa cộng Gems.** Sau khi chốt, không ghi thêm Gems/task/đóng góp vào kỳ cũ. CMS vẫn cập nhật được nội dung và public flag của showcase lịch sử, không mở lại kỳ hoặc đổi mức Gems. DB local hiện có 6 task chưa Done, vì vậy chưa thể chuyển kỳ ngay sau migration nếu chưa xử lý các task này.
- Migration giữ tên nhiệm kỳ cũ và tạo kỳ ban đầu theo tên đó; không tự đoán lịch sử nhiều kỳ từ dữ liệu cũ.

## 4. Nhiều task Done và lời chào hằng ngày

Task Board hiện có cột cuộn độc lập với max-height 640px. Bản mới mặc định chỉ lấy Done trong 14 ngày; có lựa chọn 30 ngày/toàn bộ Done, API phân trang 100 task và nút tải thêm. UI hiển thị số đã tải/tổng số để không nhầm đã xem hết. Thành viên đang hoạt động xem kỳ hiện tại; Alumni xem lịch sử riêng qua các kỳ. Không xóa task cũ để làm gọn board.

Cách ẩn Done theo tuổi tham khảo [tài liệu Jira chính thức](https://support.atlassian.com/jira-software-cloud/docs/work-with-boards-in-business-projects/). Dữ liệu lịch sử vẫn nằm trong DB.

Lời chào được tính từ task thật được giao cho người đang đăng nhập, chưa Done/chờ duyệt, đến hạn hôm nay hoặc đã quá hạn theo múi giờ Việt Nam. Có task: “Chào bạn, hôm nay bạn có X công việc cần hoàn thành”; không có: “Chúc bạn ngày mới vui vẻ”. Thông báo cập nhật trong ứng dụng; không xin quyền push trình duyệt và không gửi mail tự động.

## 5. Những phần đã bỏ và giới hạn còn lại

Đã bỏ module/API/model đổi quà, DTO/API điểm danh và khách ngoài; đổi trang EventAttendance thành EventManagement. Bỏ MSW, dev switcher, fixtures/seed mẫu, test Hello World và các fallback nghiệp vụ giả từ đợt rà trước. Các thư viện build, node_modules, migrations và ví dụ Swagger cần thiết được giữ; không xóa test nội bộ của thư viện phụ thuộc.

Không tự xóa tài khoản/task/event hiện có chỉ vì tên giống seed. Chưa đủ căn cứ xác định tất cả dữ liệu đó là giả. Ledger hiện chưa có giao dịch, nên số dư tích lũy cũ cần BCN đối soát nguồn trước khi sử dụng làm dữ liệu chuẩn. CMS vẫn xuất bản qua nhiều request, chưa thành một transaction chung. Drive chưa có đồng bộ ACL hay tạo folder Google Workspace tự động.

## 6. Kiểm chứng và migration đã áp dụng

- Build TypeScript/Vite và Nest thành công.
- Migration chạy trên PostgreSQL tạm có dữ liệu cũ; giữ nguyên hash mật khẩu, trạng thái đã thưởng, chuyển COLLABORATOR và backfill kỳ học.
- 31 kiểm thử service/DB, 15 HTTP/SSE và 3 kiểm thử CMS lịch sử đạt: phân quyền, Alumni, giao task, ledger, cộng Gems đồng thời, holderId, chuyển kỳ/nhiệm kỳ, bắt đổi mật khẩu và SSE thật.
- Diff DB tạm sau migration với Prisma schema: không có khác biệt. Các DB/fixture tạm đã dọn. Discord bị tắt trong kiểm thử.
- Chưa kiểm thử tương tác bằng trình duyệt hoặc gửi Discord thật. Build FE còn cảnh báo bundle lớn khoảng 1.1MB.

**Đã được bạn duyệt và áp dụng migration trên DB local đang có dữ liệu**: BE/backend/prisma/migrations/20261011010000_business_rules/migration.sql, Baseline initial đã được đối chiếu với schema cũ và ghi nhận trước khi deploy.

Tác động: thêm semesters, liên kết task/event/Gems theo kỳ, thông báo cá nhân/realtime; chuyển COLLABORATOR thành MEMBER; bật yêu cầu đổi mật khẩu một lần cho các tài khoản hiện có vì DB cũ chưa theo dõi lần đổi đầu; bỏ bảng điểm danh/đổi quà và đổi enum. Giữ nguyên mật khẩu, người dùng, task/event và số dư. Các organizers cũ chuyển thành đóng góp; **4 bản ghi điểm danh cũ không tự chuyển thành người đóng góp và đã được loại khỏi DB hoạt động**, nhưng có trong backup.

Backup đầy đủ: C:/Users/hoang/AppData/Local/Temp/gdgoc-before-business-1791719567732.sql.

Sau phê duyệt trực tiếp của bạn, migration đã chạy thành công trên DB local. Kiểm tra giữ nguyên 33 tài khoản/hash mật khẩu/số dư Gems, 7 task và 2 sự kiện; task/event đều gắn kỳ; 33 tài khoản được bật cờ đổi mật khẩu một lần. Schema diff trống, migrate status up-to-date và 7 trigger realtime đã tạo. Kiểm tra API đọc trên DB local đạt 5/5: CMS stats/events/organizers 200, tasks không đăng nhập 401, gifts cũ 404. Tiến trình kiểm tra đã dừng; không ghi fixture hoặc gửi Discord. Đây chưa phải bản triển khai production.


## Bổ sung sau phản hồi ảnh chụp — 11/10/2026

- Nhân sự: phân nhóm theo status và role trong membership, không suy ra BCN từ ban trống hoặc chức danh. Alumni nằm riêng dù department lịch sử là EXECUTIVE; không đổi mất dữ liệu ban/vai trò lịch sử trong DB. Bộ đếm và danh sách dùng chung quy tắc, bộ đếm theo khóa Gen đang chọn. ADVISOR/ADMIN/LEAD cùng cấp quản trị; PROBATION vẫn được chọn đóng góp. Bỏ lọc ẩn tài khoản bằng email/MSSV hardcode; danh sách phản ánh membership API.
- Gems: DB local hiện có 0 giao dịch, 33 tài khoản có số dư tích lũy khác 0. Điểm kỳ là 0 theo ledger hiện có; không tự gán số dư lịch sử vào Fall 2026. UI tách Gems trong kỳ và tích lũy toàn thời gian, không xếp hạng/podium cho 0 điểm; đồng điểm cùng hạng. Sửa tổng lịch sử theo kỳ và tên kỳ động, hiển thị lỗi tải API. Số dư cũ vẫn cần BCN đối soát nguồn.
- Sự kiện: checkbox chọn nhiều, tìm tên/MSSV, lọc ban, chọn toàn bộ kết quả hoặc bỏ chọn; vai trò chung không bắt buộc. API bulk lưu một transaction, kiểm tra nhiệm kỳ/status trước khi ghi, bỏ qua người đã có mà không ghi đè vai trò/điểm. Chọn người đóng góp không phải check-in khán giả và không tự cộng Gems; BCN duyệt riêng.
- Kiểm chứng: FE/BE build đạt; 9 kiểm thử hồi quy trên DB tạm đạt (bulk, chống trùng, Alumni, kỳ đóng, điểm kỳ/tích lũy, tổng ledger, đồng hạng, nhóm BCN). DB tạm đã dọn; DB local chỉ được đọc số liệu tổng hợp trong lượt sửa này. Chưa kiểm tra tương tác trình duyệt.
