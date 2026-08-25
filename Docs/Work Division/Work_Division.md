# KẾ HOẠCH PHÂN CHIA NHIỆM VỤ DỰ ÁN GDGoC-OS

**Nền tảng Điều Hành & Làm Việc Nội Bộ GDGoC FPTU HCMC**
_Thời gian thực hiện: Tháng 8/2026 – Tháng 10/2026_

---

## 1. TỔNG QUAN KIẾN TRÚC & NGUYÊN TẮC PHÂN BỔ

Dự án được xây dựng theo kiến trúc Modular Architecture với:

- **Backend**: NestJS 11 + Prisma ORM + Neon Serverless PostgreSQL + Google Cloud SDK / Discord SDK.
- **Frontend**: Vite + React (TypeScript) + TailwindCSS + shadcn/ui (Google Brand Theme).

### Nguyên tắc phân công công việc:

1. **Công bằng & Độc lập**: Mỗi kỹ sư Backend đảm nhận 01 Phân hệ Nghiệp vụ (CRUD) + 01 Điểm nhấn Công nghệ Chuyên sâu (Hero Feature).
2. **Kiểm soát xung đột mã nguồn**: Mỗi thành viên quản lý các thư mục module riêng biệt trong `src/modules/` để hạn chế tối đa xung đột trên Git.
3. **Quy chuẩn API-First**: Backend xây dựng Swagger API Docs chuẩn tại `http://localhost:3000/api/docs` để Frontend phát triển giao diện độc lập bằng Mock Data.

---

## 2. MA TRẬN PHÂN CÔNG NHIỆM VỤ CHI TIẾT

| Thành viên | Vị trí        | Module phụ trách trong mã nguồn                                                     | Điểm nhấn Công nghệ chuyên sâu (Hero Feature)                                                                        |
| :--------- | :------------ | :---------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| **Khang**  | Frontend Lead | `frontend/` (Toàn bộ Web UI)                                                        | **UI/UX Design System**: Vite, React, TailwindCSS, shadcn/ui (Google Brand Theme)                                    |
| **Long**   | Backend Dev   | `src/modules/tasks/`<br>`src/modules/discord/`                                      | **Discord Ecosystem Automation**: Bot Gateway, Tự tạo Thread theo Task, Slash Commands                               |
| **Minh**   | Backend Dev   | `src/modules/tenures/`<br>`src/modules/departments/`<br>`src/modules/gamification/` | **Gamification & Ledger Engine**: Sổ cái GemsTransaction chuẩn ACID, Khóa chống cộng lặp idempotencyKey, Leaderboard |
| **Nhân**   | Backend Dev   | `src/modules/drive/`<br>`src/modules/auth/`<br>`src/common/`                        | **Google Cloud Automation**: Google Drive Service Account, Tự sinh cây 4 folder chuẩn, Phân quyền Editor/Viewer      |
| **Quốc**   | Backend Dev   | `src/modules/events/`                                                               | **Realtime Streaming Engine**: Dynamic QR Code xoay vòng 15 giây qua WebSocket/SSE, Anti-Cheat Check-in              |

---

## 3. ĐẶC TẢ CHI TIẾT ĐẦU VIỆC TỪNG THÀNH VIÊN

---

### 1. KHANG — FRONTEND LEAD

- **Phạm vi mã nguồn**: Thư mục `frontend/`
- **Nhiệm vụ trọng tâm**:
  1. Khởi tạo dự án bằng Vite + React (TypeScript) + TailwindCSS + shadcn/ui, cấu hình hệ màu chuẩn Google Developer (Blue `#4285F4`, Red `#EA4335`, Yellow `#FBBC04`, Green `#34A853`).
  2. Dựa vào tài liệu Swagger API Docs của Backend để tạo Mock Data và phát triển toàn bộ giao diện độc lập.
  3. Hiện thực các màn hình chức năng:
     - **Dashboard Hub**: Tổng quan hoạt động cá nhân, số dư Gems, nhiệm vụ cần làm.
     - **Bảng Kanban Công việc**: Kéo thả công việc qua 5 cột (`@hello-pangea/dnd`), form giao việc hỗ trợ gán `PRIMARY` và `MEMBER`.
     - **Màn hình Trình chiếu Sự kiện**: Hiển thị Dynamic QR Code kích thước lớn cho máy chiếu sự kiện.
     - **Smart Drive Hub**: Bộ lọc mục lục tài nguyên đa tầng (`Niên khóa` -> `Ban` -> `Sự kiện` -> Mở link Drive).
     - **Leaderboard & Gems Shop**: Bảng vinh danh Top thành viên và giao diện đổi quà tặng.
  4. Tích hợp API thật khi Backend hoàn thiện và tối ưu trải nghiệm người dùng trên cả Desktop lẫn Mobile.

---

### 2. LONG — BACKEND DEV (TASKS & DISCORD ECOSYSTEM)

- **Phạm vi mã nguồn**: `src/modules/tasks/` và `src/modules/discord/`
- **Nhiệm vụ trọng tâm**:
  1. **Quản trị Công việc (Task Management)**:
     - Xây dựng đầy đủ API CRUD cho `Task` (Tiêu đề, Mô tả, Hạn chót, Mức độ ưu tiên `LOW`/`MEDIUM`/`HIGH`/`URGENT`, Mức Gems thưởng).
     - Hiện thực quy trình chuyển đổi 5 trạng thái Kanban: `BACKLOG` -> `TODO` -> `IN_PROGRESS` -> `IN_REVIEW` -> `DONE / OVERDUE`.
     - Quản lý phân công qua bảng `TaskAssignee`: Phân định rõ `PRIMARY` (người chủ trì) và `MEMBER` (thành viên hỗ trợ).
     - Xây dựng API nộp bài (link Google Drive / GitHub) và API phê duyệt hoàn thành.
  2. **Tự động hóa Discord (Hero Feature)**:
     - Tích hợp Bot Discord (`discord.js`): Khi có Task mới trên Web, Bot tự động tạo 1 Thread thảo luận riêng trong kênh của Ban trên Discord và tag đúng người làm (`@Primary`, `@Member`).
     - Xây dựng Slash Commands cơ bản trên Discord (`/tasks`, `/profile`) để tra cứu nhanh công việc.

---

### 3. MINH — BACKEND DEV (TENURES & GAMIFICATION LEDGER)

- **Phạm vi mã nguồn**: `src/modules/tenures/`, `src/modules/departments/`, `src/modules/gamification/`
- **Nhiệm vụ trọng tâm**:
  1. **Quản trị Niên khóa & Cơ cấu Ban**:
     - Xây dựng API CRUD cho `Tenure` (Quản lý các thế hệ Gen, đóng băng dữ liệu `isFrozen`, đóng gói bàn giao `isArchived`).
     - Xây dựng API CRUD cho `Department` (4 Ban chuyên môn + Ban Chủ Nhiệm).
     - Xây dựng API CRUD cho Cửa hàng quà tặng `GiftItem` và tiếp nhận đơn đổi quà `GiftRedemption`.
  2. **Cỗ máy Gamification & Sổ cái Điểm (Hero Feature)**:
     - Xây dựng hệ thống giao dịch điểm `GemsTransaction` hoạt động như một sổ cái kế toán (Ledger), áp dụng Prisma Interactive Transaction (`$transaction`) đảm bảo chuẩn ACID.
     - Cài đặt cơ chế khóa chống cộng lặp điểm (`idempotencyKey`).
     - Xây dựng thuật toán tính toán và trả về dữ liệu Bảng xếp hạng Leaderboard theo Tuần, Tháng, Kỳ học và theo từng Ban.

---

### 4. NHÂN — BACKEND DEV (DRIVE AUTOMATION & AUTH CORE)

- **Phạm vi mã nguồn**: `src/modules/drive/`, `src/modules/auth/`, `src/common/`
- **Nhiệm vụ trọng tâm**:
  1. **Hạ tầng Xác thực & Bảo mật (Auth Core)**:
     - Thiết lập Module `Auth` (Đăng ký, Đăng nhập, Mã hóa mật khẩu bcrypt, cấp phát JWT Token).
     - Xây dựng các Guard và Decorator dùng chung trong `src/common/` (`JwtAuthGuard`, `RolesGuard`, `@Roles()`, `@CurrentUser()`) để phân quyền RBAC toàn hệ thống.
  2. **Quản lý Mục lục Tài nguyên (Drive Catalog)**:
     - Xây dựng API CRUD cho `DriveAsset` (Phân loại Brandkit, Slide đào tạo, Media, Báo cáo tài chính, phân quyền truy cập Public / Internal / Executive).
  3. **Tự động hóa Google Cloud Drive (Hero Feature)**:
     - Tích hợp Google Cloud Service Account (`googleapis`).
     - Tự động sinh cấu trúc 4 thư mục chuẩn (`01-Design-Assets`, `02-Photos-Raw`, `03-Slide-Speaker`, `04-Proposal-KichBan`) khi có sự kiện mới.
     - Tự động phân quyền Editor cho email sinh viên `@fpt.edu.vn` theo Ban và hạ quyền xuống Viewer khi kết thúc niên khóa.

---

### 5. QUỐC — BACKEND DEV (EVENTS & REALTIME DYNAMIC QR)

- **Phạm vi mã nguồn**: `src/modules/events/`
- **Nhiệm vụ trọng tâm**:
  1. **Quản trị Chu trình Sự kiện**:
     - Xây dựng API CRUD cho `Event` (Workshop, Hackathon, Meeting, Teambuilding, thiết lập thời gian, địa điểm, quỹ Gems).
     - Xây dựng chức năng phân công Ban Tổ Chức (`EventOrganizer`) cho 4 ban chuyên môn và tự động quyết toán Gems cống hiến (+100 Gems) cho BTC.
  2. **Cơ chế Điểm danh Realtime Dynamic QR 15s (Hero Feature)**:
     - Xây dựng luồng phát mã QR động qua WebSocket / SSE (Server-Sent Events): Mã QR tự làm mới mỗi 15 giây trên màn hình chiếu sự kiện.
     - Xây dựng thuật toán mã hóa Token ngắn hạn (Time-based Token) và API xác thực Check-in chống gian lận (chống chụp ảnh gửi ra ngoài).
     - Xây dựng API điểm danh kèm tải ảnh bằng chứng (`evidenceImageUrl`) cho các hoạt động ngoại khóa.

---

## 4. QUY TRÌNH PHỐI HỢP & TRIỂN KHAI

1. **Quy ước nhánh Git (Git Flow)**:
   - Nhánh chính: `main` (Production) và `develop` (Staging).
   - Mỗi thành viên tạo nhánh tính năng từ `develop`: `feature/ten-tinh-nang` (Ví dụ: `feature/task-kanban`, `feature/drive-automation`, `feature/event-qr`, `feature/gamification-ledger`).
   - Tạo Pull Request (PR) và yêu cầu thành viên trong team review trước khi merge vào `develop`.
2. **Cơ sở dữ liệu dùng chung (Neon PostgreSQL)**:
   - Toàn bộ team sử dụng chung connection string `DATABASE_URL` từ Neon DB.
   - Khi cần bổ sung field trong `schema.prisma`, thảo luận trước trong nhóm kỹ thuật để cùng đồng bộ.
3. **Mục tiêu Sprint 1**:
   - Hoàn thiện toàn bộ các API CRUD và Swagger Docs trong 2-3 tuần đầu để Frontend có đầy đủ API ráp giao diện.
