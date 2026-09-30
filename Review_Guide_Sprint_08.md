# 🧐 GDGoC Platform — Hướng Dẫn Nghiệm Thu Toàn Diện (End-to-End Test Guide)
**Dành cho:** Web Lead & Frontend Lead  
**Phân hệ:** Tích Hợp Hệ Thống & Kiểm Thử Toàn Diện (Sprint 08)  
**Thời gian:** 23/09/2026  

---

## 🎯 1. Kịch Bản Kiểm Thử Thông Luồng 10 Màn Hình Nghiệp Vụ (E2E Test Flow)

### 🔹 Bước 1: Khởi động 2 Dịch Vụ
1. **Terminal 1 (Backend):**
   ```powershell
   cd d:\GDG-Management\backend
   npm run start:dev
   ```
2. **Terminal 2 (Frontend):**
   ```powershell
   cd d:\GDG-Management-FE
   npm run dev
   ```

---

### 🔹 Bước 2: Kiểm Thử Landing Page (Public Không Cần Login)
- Mở trình duyệt tại **`http://localhost:5173`**:
  - Section **Impact Milestones**: Hiển thị 4 thẻ thống kê tác động từ `GET /api/cms/stats`.
  - Section **Upcoming Events**: Hiển thị sự kiện công khai từ `GET /api/cms/events`.
  - Section **Core Team / Organizers**: Hiển thị danh sách ban điều hành từ `GET /api/members/organizers`.

---

### 🔹 Bước 3: Kiểm Thử Đăng Nhập & Cookie HttpOnly
1. Nhấn nút **"Portal"** ở góc phải thanh Header hoặc vào `http://localhost:5173/login`.
2. Đăng nhập tài khoản BCN:
   - **Email:** `admin@fpt.edu.vn` (hoặc email đã seed trong database)
   - **Mật khẩu:** mật khẩu quản trị
3. 👉 **Kỳ vọng:** Trình duyệt tự động nhận Cookie `session_token` (HttpOnly), lưu trữ phiên làm việc an toàn và chuyển hướng thẳng vào `/app/dashboard`.

---

### 🔹 Bước 4: Kiểm Thử Quản Lý Nhân Sự & Import Excel (`/app/hr`)
1. Truy cập màn hình **HR Management**.
2. Kiểm tra bộ lọc ban chuyên môn (Tech AI, Web, Cloud, Media, HR-Event) và tìm kiếm theo tên/MSSV.
3. Nhấn **"Import Excel"** -> Chọn file mẫu `.xlsx` -> Bấm Tải lên.
4. 👉 **Kỳ vọng:** Dữ liệu thành viên mới được thêm hàng loạt vào hệ thống và hiển thị ngay trên bảng danh sách.

---

### 🔹 Bước 5: Kiểm Thử Sự Kiện & Điểm Danh Tại Bàn (`/app/events`)
1. Tạo một sự kiện mới (Workshop / Codelab).
2. Nhấn vào sự kiện để mở danh sách điểm danh.
3. Thử check-in trực tiếp tại bàn bằng cách nhập thông tin sinh viên hoặc toggle trạng thái check-in.
4. 👉 **Kỳ vọng:** Tỷ lệ điểm danh `attendanceRate` và số người tham gia tự động nhảy số theo thời gian thực.

---

### 🔹 Bước 6: Kiểm Thử Kanban Task & Tự Động Cấp Gems (`/app/tasks`)
1. Tạo một task mới, gán thành viên ban và đặt số Gems thưởng (ví dụ: 50 Gems).
2. Di chuyển task từ `TODO` sang `IN_PROGRESS`.
3. Nhấn nộp bài nghiệm thu (nhập link GitHub PR hoặc Google Drive) -> Task chuyển sang `IN_REVIEW`.
4. BCN nhấn **"Phê duyệt (Approve)"** và nhập nhận xét feedback.
5. 👉 **Kỳ vọng:**
   - Task chuyển sang cột `DONE`.
   - Thành viên được gán tự động nhận 50 Gems vào ví `gemsBalance` thông qua giao dịch ACID an toàn.

---

### 🔹 Bước 7: Kiểm Thử Sổ Cái Gems & Cửa Hàng Đổi Quà (`/app/gems`)
1. Mở màn hình **Gems Leaderboard**: Kiểm tra thứ hạng của các thành viên và chỉ số tăng trưởng tuần `+X tuần này`.
2. Mở tab **Lịch sử Giao dịch**: Xem các bản ghi cộng Gems từ Task và Điểm danh.
3. Mở tab **Cửa hàng Quà tặng (Gift Shop)**: Chọn đổi Áo Hoodie -> Số dư Gems bị trừ ngay, tồn kho giảm 1, đơn chuyển sang `PENDING`.
4. BCN vào duyệt đơn hoặc từ chối đơn -> Nếu từ chối, Gems và tồn kho tự động được hoàn lại 100%.

---

### 🔹 Bước 8: Kiểm Thử Kho Hậu Cần & Trung Tâm Thông Báo (`/app/inventory`, `/app/notifications`)
1. Thêm vật tư mới vào kho (Standee, Micro không dây).
2. BCN bấm phát thông báo khẩn Broadcast toàn CLB.
3. Biểu tượng chuông thông báo trên Header hiển thị số đỏ `unreadCount`.
4. Nhấn **"Đánh dấu đã đọc tất cả"** -> Số đỏ biến mất.

---

### 🔹 Bước 9: Kiểm Thử Chuyển Giao Nhiệm Kỳ (`/app/settings/generation`)
1. Xem snapshot số liệu của các nhiệm kỳ quá khứ.
2. Nhấn **"Chuyển giao nhiệm kỳ mới (Transition)"** (ví dụ: `Spring 2027 - Gen 4.5`).
3. 👉 **Kỳ vọng:** Kỳ cũ được đóng băng và lưu trữ an toàn, kỳ mới được kích hoạt, Core Team được tự động kế thừa sang kỳ mới.
