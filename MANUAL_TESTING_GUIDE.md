# 🧪 GDGoC Platform — Sổ Tay Hướng Dẫn Kiểm Thử Thủ Công (Manual Testing Guide)
**Dự án:** GDGoC FPTU HCMC Portal (Backend NestJS & Frontend React 19)  
**Mục tiêu:** Hướng dẫn từng bước kiểm thử luồng nghiệp vụ (Manual E2E Testing) trước khi triển khai automation test.  
**Mật khẩu chung cho tất cả tài khoản:** `GDGoC@2026`

---

## 🔑 1. Danh Sách Tài Khoản Kiểm Thử (Test Accounts)

Tất cả tài khoản dưới đây đã được nạp sẵn vào cơ sở dữ liệu (`seed.ts`):

| STT | Họ và Tên | Email Đăng Nhập | MSSV | Vai Trò (Role) | Ban (Department) | Quyền hạn chính |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| 1 | **Đặng Mai Phương** | `lead@gdgfptu.dev` | `SE180001` | **LEAD** | Ban Chủ Nhiệm | Toàn quyền quản trị hệ thống (Full Admin), duyệt đơn đổi quà, duyệt task, tạo nhiệm kỳ mới, import Excel. |
| 2 | **ThS. Trần Hoàng Nam** | `advisor@gdgfptu.dev` | `AD100001` | **ADVISOR** | Ban Chủ Nhiệm | Cố vấn CLB: Quyền xem (Read-only) toàn bộ báo cáo, nhân sự, tài chính, không có nút sửa/xóa. |
| 3 | **Phạm Gia Huy** | `web.lead@gdgfptu.dev` | `SE180003` | **DEPARTMENT_LEAD** | Ban Phát Triển Web | Quản lý task & thành viên ban Web, tạo task, review task. |
| 4 | **Lê Hoàng Long** | `ai.lead@gdgfptu.dev` | `SE180002` | **DEPARTMENT_LEAD** | Ban Trí Tuệ Nhân Tạo | Quản lý task & thành viên ban AI, quản trị tài nguyên AI. |
| 5 | **Nguyễn Thảo Vy** | `hr.lead@gdgfptu.dev` | `SE180004` | **DEPARTMENT_LEAD** | Ban HR & Sự Kiện | Quản lý sự kiện, **quyền độc quyền xác nhận điểm danh (Check-in)**, kho vật tư. |
| 6 | **Trần Minh Quân** | `media.lead@gdgfptu.dev` | `SE180005` | **DEPARTMENT_LEAD** | Ban Truyền Thông | Quản lý ấn phẩm Media, Drive assets, nội dung truyền thông. |
| 7 | **Hoàng Kim Ngân** | `member.web@gdgfptu.dev` | `SE180007` | **MEMBER** | Ban Phát Triển Web | Nhận task, kéo thả Kanban, nộp link bài làm (`submissionUrl`), đổi quà bằng Gems. |
| 8 | **Vũ Đức Thành** | `member.ai@gdgfptu.dev` | `SE180006` | **MEMBER** | Ban Trí Tuệ Nhân Tạo | Nhận task AI, tích lũy Gems, xem sự kiện. |
| 9 | **Đỗ Tuấn Kiệt** | `member.hr@gdgfptu.dev` | `SE180008` | **MEMBER** | Ban HR & Sự Kiện | Hỗ trợ check-in sự kiện, quản lý danh sách attendees. |
| 10 | **Bùi Yến Nhi** | `ctv.media@gdgfptu.dev` | `SE180009` | **COLLABORATOR** | Ban Truyền Thông | Trạng thái thử việc (`PROBATION`), thực hiện task được giao. |

---

## 🚀 2. Hướng Dẫn Khởi Động Hệ Thống

Mở **2 cửa sổ Terminal (PowerShell)**:

### Cửa sổ 1: Khởi động Backend (Port 8080)
```powershell
cd d:\GDG-Management\backend
npm run start:dev
```
- API Docs (Swagger): [http://localhost:8080/api/docs](http://localhost:8080/api/docs)

### Cửa sổ 2: Khởi động Frontend (Port 5173)
```powershell
cd d:\GDG-Management-FE
npm run dev
```
- Giao diện người dùng: [http://localhost:5173](http://localhost:5173)

---

## 📋 3. Chi Tiết 10 Luồng Kiểm Thử Thủ Công (Manual Test Flows)

### 🔹 Luồng 1: Đăng Nhập & Phân Quyền (Auth & Dev Switcher)
- **Mục tiêu:** Kiểm tra cơ chế đăng nhập bằng HttpOnly Cookie `session_token` và phân quyền hiển thị.
- **Các bước thực hiện:**
  1. Truy cập `http://localhost:5173/login`.
  2. Nhập Email `lead@gdgfptu.dev`, Mật khẩu `GDGoC@2026` -> Nhấn **Đăng nhập**.
  3. Kiểm tra trình duyệt tự động chuyển hướng vào `/app/dashboard`.
  4. Mở DevTools (F12) -> Tab **Application** -> **Cookies** -> Xác nhận có cookie `session_token` (có cờ `HttpOnly`).
  5. Thử widget **Dev User Switcher** (nằm ở góc dưới màn hình): Bấm chuyển nhanh giữa các tài khoản `Chapter Lead`, `Web Lead`, `Member Web` để thấy giao diện và menu điều chỉnh theo đúng role.
  6. Nhấn nút **Đăng xuất** ở thanh Sidebar -> Hệ thống xóa cookie và đưa về `/login`.

---

### 🔹 Luồng 2: Quản Lý Nhân Sự & Import File Excel (`/app/hr`)
- **Tài khoản test:** `lead@gdgfptu.dev` (hoặc `hr.lead@gdgfptu.dev`)
- **Các bước thực hiện:**
  1. Vào menu **Nhân sự & Thành viên** (`/app/hr`).
  2. **Kiểm tra bộ lọc:** Lọc theo Ban (Web / AI / HR), lọc theo Trạng thái (`Active` / `Probation`), nhập từ khóa tìm kiếm MSSV hoặc tên.
  3. **Thêm mới thành viên:** Nhấn **+ Thêm thành viên**, nhập MSSV `SE189999`, Email `test.new@gdgfptu.dev`, Họ tên `Nguyễn Văn Test`, chọn Ban `TECH_WEB` -> Bấm Lưu.
  4. **Import Excel:** Bấm nút **Import Excel**, chọn 1 file `.xlsx` danh sách sinh viên -> Bấm Tải lên -> Kiểm tra danh sách tự động cập nhật và hiển thị thông báo thành công.
  5. **Đổi vai trò / Cập nhật:** Bấm vào 1 thành viên -> Thay đổi Chức danh hoặc Phân ban -> Lưu lại.

---

### 🔹 Luồng 3: Quản Lý Sự Kiện & Điểm Danh Tại Bàn (`/app/events`)
- **Tài khoản test:** `hr.lead@gdgfptu.dev` (HR Lead) và `member.web@gdgfptu.dev` (Thành viên)
- **Các bước thực hiện:**
  1. Đăng nhập `hr.lead@gdgfptu.dev` -> Vào menu **Sự kiện & Điểm danh** (`/app/events`).
  2. **Tạo sự kiện mới:** Nhấn **+ Tạo sự kiện**, nhập tiêu đề "Google Cloud Study Jam 2026", địa điểm "Phòng 301 Tòa Alpha", thiết lập Thưởng tham dự `25 Gems`, Thưởng BTC `80 Gems` -> Bấm Tạo.
  3. **Quản lý danh sách điểm danh (Attendees):**
     - Chọn sự kiện "Kick-off All-Hands Meeting Gen 4.0".
     - Thấy danh sách người tham gia.
     - Bấm nút **Toggle Xác nhận điểm danh** cho thành viên `Vũ Đức Thành` (trạng thái chuyển từ Chưa xác nhận sang Đã xác nhận ✅).
     - Hệ thống tự động ghi nhận bản ghi điểm danh `EventAttendance`.

---

### 🔹 Luồng 4: Bảng Kanban Tasks & Nộp Bài Nghiệm Thu (`/app/tasks`)
- **Tài khoản test:** `member.web@gdgfptu.dev` (Member làm bài) & `web.lead@gdgfptu.dev` (Lead duyệt bài)
- **Các bước thực hiện:**
  1. **Bước A (Member làm bài):**
     - Đăng nhập `member.web@gdgfptu.dev` -> Vào **Bảng Nhiệm vụ** (`/app/tasks`).
     - Tìm task đang ở cột **TODO** hoặc **IN_PROGRESS**.
     - Kéo thả thẻ task sang cột **IN_REVIEW**.
     - Bấm vào task -> Điền Link nộp bài (`submissionUrl`, ví dụ `https://github.com/my-pr/1`) -> Nhấn **Nộp bài nghiệm thu**.
  2. **Bước B (Lead review & Thưởng Gems):**
     - Đăng nhập `web.lead@gdgfptu.dev` -> Vào `/app/tasks`.
     - Nhấp vào task vừa nộp ở cột **IN_REVIEW**.
     - Nhập nhận xét: "Bài làm rất tốt, code sạch sẽ!" -> Nhấn nút **Duyệt bài (Approve)**.
     - Thẻ task tự động chuyển sang cột **DONE**.
     - **Kiểm tra tự động cấp Gems:** Hệ thống kích hoạt trigger cấp số Gems của task cho Member và ghi vào sổ cái `GemsTransaction`.

---

### 🔹 Luồng 5: Sổ Cái Gems, Bảng Xếp Hạng & Đổi Quà (`/app/gems`)
- **Tài khoản test:** `member.web@gdgfptu.dev` (Đổi quà) & `lead@gdgfptu.dev` (Duyệt đơn)
- **Các bước thực hiện:**
  1. Đăng nhập `member.web@gdgfptu.dev` -> Vào menu **Gems & Đổi quà** (`/app/gems`).
  2. **Xem Bảng xếp hạng (Leaderboard):** Kiểm tra thứ hạng cá nhân, số Gems hiện có và biến động thứ hạng (Delta).
  3. **Xem Sổ cái giao dịch:** Kiểm tra lịch sử cộng/trừ Gems (Thưởng task, Điểm danh sự kiện).
  4. **Đổi quà (Redeem Gift):**
     - Chọn món quà "Áo thun GDGoC FPTU Premium Tee" (120 Gems) -> Bấm **Đổi quà**.
     - Kiểm tra số dư Gems bị trừ ngay lập tức và đơn đổi quà ở trạng thái `PENDING`.
  5. **Duyệt đơn đổi quà:**
     - Đăng nhập `lead@gdgfptu.dev` -> Vào tab **Quản lý đơn đổi quà**.
     - Nhấn **Duyệt (Approve)** hoặc **Từ chối (Reject)** (Nếu từ chối, kiểm tra số Gems được hoàn lại tự động cho Member).

---

### 🔹 Luồng 6: Quản Lý Kho Vật Tư & Tài Sản CLB (`/app/inventory`)
- **Tài khoản test:** `hr.lead@gdgfptu.dev` hoặc `lead@gdgfptu.dev`
- **Các bước thực hiện:**
  1. Vào menu **Kho vật tư** (`/app/inventory`).
  2. Xem danh mục phân loại: *Tài sản cố định (Standee, Mic, Loa)*, *Quà tặng (Áo thun, Bình nước)*, *Vật tư tiêu hao (Dây đeo thẻ, Sticker)*.
  3. Bấm **+ Thêm vật tư mới**, nhập tên "Bàn phím cơ dự phòng", số lượng `2`, người giữ "Lưu tại kho CLB" -> Lưu.
  4. Bấm **Bàn giao / Chuyển người giữ** vật tư -> Cập nhật sang tên thành viên khác.

---

### 🔹 Luồng 7: Kho Tài Nguyên Thông Minh (Asset Hub) (`/app/assets`)
- **Tài khoản test:** `media.lead@gdgfptu.dev`
- **Các bước thực hiện:**
  1. Vào menu **Kho tài nguyên** (`/app/assets`).
  2. Lọc theo danh mục: *Brand Kit*, *Tech Library*, *Media Vault*, *PR Comms*, *Tài chính*.
  3. Bấm vào tài nguyên -> Mở link Google Drive tương ứng trong tab mới.
  4. Bấm **+ Thêm tài nguyên Drive**, dán URL Google Drive và đặt quyền truy cập (`PUBLIC`, `INTERNAL_MEMBER`, `EXECUTIVE_ONLY`).

---

### 🔹 Luồng 8: Cấu Hình Nhiệm Kỳ & Landing Page CMS (`/app/settings/generation` & `/app/landing-cms`)
- **Tài khoản test:** `lead@gdgfptu.dev` (Chỉ Chapter Lead có quyền)
- **Các bước thực hiện:**
  1. Vào menu **Cài đặt Nhiệm kỳ** (`/app/settings/generation`).
  2. Xem thông tin nhiệm kỳ hiện tại (`Fall 2026 - Gen 4.0`).
  3. Thử tính năng **Chuyển giao nhiệm kỳ (Transition)**: Nhập tên kỳ mới "Spring 2027 - Gen 4.5" -> Xem xác nhận đóng băng kỳ cũ.
  4. Vào menu **Landing Page CMS** (`/app/landing-cms`):
     - Chỉnh sửa các chỉ số thống kê (Số thành viên: 150+, Sự kiện: 20+, Workshop: 12+).
     - Bật/Tắt hiển thị sự kiện công khai ra ngoài trang chủ.

---

### 🔹 Luồng 9: Tự Cập Nhật Trang Cá Nhân (`/app/profile`)
- **Tài khoản test:** Bất kỳ tài khoản nào (ví dụ `member.web@gdgfptu.dev`)
- **Các bước thực hiện:**
  1. Nhấp vào Avatar góc trên cùng bên phải -> Chọn **Trang cá nhân** (`/app/profile`).
  2. Chỉnh sửa Bio, thêm kỹ năng mới (`Docker`, `Tailwind CSS`), cập nhật link GitHub, LinkedIn, Facebook.
  3. Nhấn **Lưu thay đổi** -> Tải lại trang (F5) để xác nhận dữ liệu đã được lưu bền vững vào PostgreSQL.
  4. Thử đổi mật khẩu mới trong phần **Bảo mật**.

---

### 🔹 Luồng 10: Kiểm Tra Landing Page Công Khai (`/`)
- **Tài khoản test:** Khách truy cập (Chưa đăng nhập)
- **Các bước thực hiện:**
  1. Mở cửa sổ ẩn danh (Incognito) truy cập: `http://localhost:5173`.
  2. Kiểm tra các Section:
     - **Hero Section:** Banner, khẩu hiệu, nút "Ứng tuyển ngay" (mở modal đăng ký).
     - **Tracks (Các Ban):** Xem chi tiết JD Handbook của từng ban (AI, Cloud, Web, Media, HR-Event).
     - **Impact Numbers:** Số liệu thống kê đồng bộ từ Backend CMS.
     - **Upcoming Events:** Danh sách sự kiện `isPublic: true` lấy từ API Backend thật.
     - **Core Team Organizers:** Danh sách Ban Điều Hành lấy từ API `GET /api/members/organizers`.
  3. Bấm nút **Đăng nhập thành viên** ở góc trên -> Chuyển hướng mượt mà vào trang `/login`.

---

## ✅ 4. Bảng Checklist Đánh Giá Nghiệm Thu

| STT | Luồng kiểm thử | Trạng thái Manual Test | Ghi chú / Kết quả |
| :---: | :--- | :---: | :--- |
| 1 | Auth HttpOnly Cookie & Phân quyền RBAC | 🔲 Chưa test / 🟩 Đạt | |
| 2 | Quản lý Nhân sự & Import Excel | 🔲 Chưa test / 🟩 Đạt | |
| 3 | Quản lý Sự kiện & Điểm danh tại bàn | 🔲 Chưa test / 🟩 Đạt | |
| 4 | Kanban Board, Nộp bài & Cấp Gems tự động | 🔲 Chưa test / 🟩 Đạt | |
| 5 | Leaderboard, Sổ cái Gems & Đổi quà | 🔲 Chưa test / 🟩 Đạt | |
| 6 | Quản lý Kho vật tư CLB | 🔲 Chưa test / 🟩 Đạt | |
| 7 | Kho tài nguyên Google Drive Asset Hub | 🔲 Chưa test / 🟩 Đạt | |
| 8 | Cấu hình nhiệm kỳ & Landing CMS | 🔲 Chưa test / 🟩 Đạt | |
| 9 | Trang cá nhân & Đổi mật khẩu | 🔲 Chưa test / 🟩 Đạt | |
| 10 | Landing Page Public & Modal JD | 🔲 Chưa test / 🟩 Đạt | |
