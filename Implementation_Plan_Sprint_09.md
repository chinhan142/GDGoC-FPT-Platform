# Implementation Plan — Sprint 09: Frontend-Backend Integration, Mock Data Cleanup & API Architecture

**Mục tiêu Sprint:** Đồng bộ hóa toàn diện Frontend với Backend, xóa bỏ hoàn toàn mock data / MSW / static hardcoded datasets, tái cấu trúc thư mục API theo domain modules và chuẩn hóa payload 2 chiều.

---

## 1. Yêu Cầu Kỹ Thuật & Phạm Vi (Scope)

1. **API Client & Modules (`src/api/`)**:
   - Tái cấu trúc từ flat files sang `src/api/modules/` với 11 domain modules chuẩn.
   - Thêm `assets.api.ts` kết nối `/api/assets` và `/api/drive/create-folder`.
   - Chuẩn hóa HTTP Client unwrap `{ data, message }` từ `TransformInterceptor` của NestJS.

2. **Dọn Dẹp Mock Data (`src/mocks/`)**:
   - Xóa bỏ hoàn toàn MSW browser worker, handlers và fixtures.
   - Di chuyển `UserSession`, `Tier`, `BanId`, `BAN_NAMES`, RBAC helpers sang `src/types/auth.types.ts`.

3. **Đồng Bộ Hóa UI & Stores Với Backend**:
   - `AssetHub.tsx`: Xóa mảng tĩnh `ASSET_FOLDERS`, kéo trực tiếp từ `assetsApi.getAssets()`, hỗ trợ tạo và xóa tài nguyên Drive.
   - `DashboardOverview.tsx`: Xóa đọc `localStorage.getItem('gdgoc_tasks_v2')`, kéo realtime từ `tasksApi`, `eventsApi`, `gemsApi`, `useMemberStore`.
   - `TaskBoard.tsx`: Xóa `tenureId` hardcoded; sử dụng dynamic `activeTenureId` từ Store/BE.
   - `EventAttendance.tsx`: Kéo sự kiện và điểm danh trực tiếp qua `eventsApi.getEvents()`, `eventsApi.getAttendees()`, `eventsApi.toggleCheckin()`.
   - `GenerationSettings.tsx`: Đồng bộ hóa cấu hình niên khóa qua `generationApi.getGenerationConfig()`, `updateGenerationConfig()`, `transitionTenure()`.
   - `LandingCMS.tsx` & Landing Page: Tích hợp `cmsApi.getStats()`, `cmsApi.getPublicEvents()`, `membersApi.getOrganizers()`.

4. **Cam Kết Bảo Mật (Security Compliance)**:
   - Toàn bộ request sử dụng HttpOnly Cookie `session_token` tự động gắn bởi trình duyệt qua `credentials: 'include'`.
   - Không hardcode secrets, token hay thông tin nhạy cảm.

---

## 2. Kế Hoạch Kiểm Thử (Verification Plan)

1. Kiểm tra build Frontend: `npm run build` không phát sinh lỗi TypeScript hay import gãy.
2. Kiểm tra build Backend: `npm run build` thành công.
3. Chạy Seed Database: Thực thi `npm run seed` với dữ liệu test chất lượng cao trên PostgreSQL.
