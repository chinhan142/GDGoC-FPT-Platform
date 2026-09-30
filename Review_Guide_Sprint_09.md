# Review Guide — Sprint 09: Frontend-Backend Integration & Mock Data Cleanup

**Dành cho:** Web Lead & Team Reviewers  
**Mục tiêu:** Rà soát tính toàn vẹn của việc tích hợp Frontend và Backend, loại bỏ hoàn toàn mock data và kiểm tra tính nhất quán của API contract.

---

## 1. Trình Tự Rà Soát Code (Step-by-Step Code Review)

### Bước 1: Rà soát cấu trúc thư mục API (`src/api/`)
1. Kiểm tra thư mục `src/api/modules/`:
   - Phải có đủ 11 file tương ứng các domain (`auth`, `members`, `tasks`, `events`, `assets`, `inventory`, `gems`, `gifts`, `generation`, `cms`, `notifications`).
2. Kiểm tra `src/api/client.ts`:
   - Xác nhận cờ `credentials: 'include'` luôn được bật trong `fetch`.
   - Xác nhận cơ chế tự động unwrap `{ data: ... }` khi backend trả về cấu trúc bọc bởi `TransformInterceptor`.
3. Kiểm tra `src/api/index.ts`:
   - Xác nhận re-export đầy đủ các API modules để phía components/stores dễ dàng import.

### Bước 2: Rà soát loại bỏ Mock Data
1. Xác nhận thư mục `src/mocks/` đã bị xóa hoàn toàn.
2. Kiểm tra `src/types/auth.types.ts`:
   - Xác nhận chứa đầy đủ các định nghĩa: `UserSession`, `Tier`, `BanId`, `BAN_NAMES`, `canManageEvents`, `isOrgAdmin`, `canManageHR`, `mapBackendUserToSession`.
   - Kiểm tra các mappers `DEPT_CODE_TO_BAN_ID` và `BAN_ID_TO_DEPT_CODE` khớp đúng enum `DepartmentType` từ Prisma.

### Bước 3: Rà soát các màn hình UI & Stores
1. **AssetHub (`src/pages/internal/AssetHub.tsx`)**:
   - Xác nhận không còn mảng tĩnh `ASSET_FOLDERS`.
   - Kiểm tra chức năng gọi `assetsApi.getAssets()`, `assetsApi.createAsset()` và `assetsApi.deleteAsset()`.
2. **DashboardOverview (`src/pages/internal/DashboardOverview.tsx`)**:
   - Xác nhận không còn đọc `localStorage.getItem('gdgoc_tasks_v2')`.
   - Số liệu tasks, members, events được tính toán từ các API call thực tế.
3. **TaskBoard (`src/pages/internal/TaskBoard.tsx`)**:
   - Xác nhận `tenureId` không bị hardcode thành chuỗi tĩnh mà lấy từ `activeTenureId`.
   - Thao tác chuyển cột trạng thái (Kanban drag/status update) gọi `tasksApi.updateStatus()`.
4. **EventAttendance (`src/pages/internal/EventAttendance.tsx`)**:
   - Sự kiện được kéo từ `eventsApi.getEvents()`.
   - Danh sách người tham gia được kéo từ `eventsApi.getAttendees(eventId)`.
   - Điểm danh gửi patch request `eventsApi.toggleCheckin(eventId, attendeeId, { isVerified })`.
5. **GenerationSettings (`src/pages/internal/GenerationSettings.tsx`)**:
   - Fetch cấu hình từ `GET /api/config/generation`.
   - Transition wizard gọi `POST /api/config/generation/transition`.

---

## 2. Kịch Bản Kiểm Tra Nhanh (Fast Verification Checklist)

1. **Khởi động Backend**:
   ```bash
   cd d:\GDG-Management\backend
   npm run start:dev
   ```
2. **Khởi động Frontend**:
   ```bash
   cd d:\GDG-Management-FE
   npm run dev
   ```
3. **Đăng nhập thử nghiệm**:
   - Sử dụng tài khoản Chapter Lead: `lead@gdgfptu.dev` / `GDGoC@2026`.
   - Kiểm tra profile hiển thị đúng vai trò `👑 Ban Chủ Nhiệm`.
4. **Kiểm tra các tab chức năng**:
   - **HR Management**: Xem danh sách 10 thành viên test từ database.
   - **Task Board**: Xem các task mẫu đã được phân công theo ban.
   - **Event Attendance**: Xem danh sách sự kiện và mở modal điểm danh.
   - **Asset Hub**: Xem danh sách tài nguyên Drive và thử đăng ký tài nguyên mới.
   - **Gems & Gift Shop**: Xem bảng xếp hạng leaderboard và danh mục quà tặng.
