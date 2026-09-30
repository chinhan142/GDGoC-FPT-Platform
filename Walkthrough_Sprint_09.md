# Walkthrough — Sprint 09: Frontend-Backend Integration & API Refactoring

## 1. Danh Sách Tệp Đã Tạo & Chỉnh Sửa

### Frontend (`d:\GDG-Management-FE\`)
- `src/types/auth.types.ts` [NEW]: Định nghĩa chuẩn cho UserSession, Tier, BanId, RBAC permissions & mapping.
- `src/api/client.ts` [MODIFY]: HTTP Client trung tâm unwrap response envelope, error handler và query string builder.
- `src/api/index.ts` [MODIFY]: Barrel export tất cả API modules.
- `src/api/modules/auth.api.ts` [NEW]: Endpoints `/api/auth/*`.
- `src/api/modules/members.api.ts` [NEW]: Endpoints `/api/members/*`.
- `src/api/modules/tasks.api.ts` [NEW]: Endpoints `/api/tasks/*`.
- `src/api/modules/events.api.ts` [NEW]: Endpoints `/api/events/*`.
- `src/api/modules/assets.api.ts` [NEW]: Endpoints `/api/assets/*` & `/api/drive/*`.
- `src/api/modules/inventory.api.ts` [NEW]: Endpoints `/api/inventory/*`.
- `src/api/modules/gems.api.ts` [NEW]: Endpoints `/api/gems/*`.
- `src/api/modules/gifts.api.ts` [NEW]: Endpoints `/api/gifts/*`.
- `src/api/modules/generation.api.ts` [NEW]: Endpoints `/api/config/generation/*`.
- `src/api/modules/cms.api.ts` [NEW]: Endpoints `/api/cms/*`.
- `src/api/modules/notifications.api.ts` [NEW]: Endpoints `/api/notifications/*`.
- `src/mocks/` [DELETED]: Xóa bỏ hoàn toàn MSW browser worker, fixtures và mock handlers.
- `src/store/useAuthStore.ts` [MODIFY]: Sử dụng auth.types.ts và authApi.
- `src/store/useMemberStore.ts` [MODIFY]: Tích hợp membersApi, generationApi và tenureId động.
- `src/store/useGenerationStore.ts` [MODIFY]: Tích hợp generationApi trực tiếp với Backend.
- `src/store/useInventoryStore.ts` [MODIFY]: Tích hợp inventoryApi.
- `src/store/useNotificationStore.ts` [MODIFY]: Tích hợp notificationsApi.
- `src/store/useLandingContentStore.ts` [MODIFY]: Tích hợp cmsApi, membersApi.
- `src/pages/internal/AssetHub.tsx` [MODIFY]: Thay thế mảng tĩnh bằng dynamic fetch assets từ API.
- `src/pages/internal/DashboardOverview.tsx` [MODIFY]: Xóa localStorage, kéo realtime từ BE.
- `src/pages/internal/TaskBoard.tsx` [MODIFY]: Chuyển sang tenureId động và kết nối tasksApi.
- `src/pages/internal/EventAttendance.tsx` [MODIFY]: Kết nối eventsApi cho quản lý sự kiện và điểm danh.
- `src/pages/internal/GenerationSettings.tsx` [MODIFY]: Fetch và update cấu hình qua Backend.
- `src/pages/internal/LandingCMS.tsx` [MODIFY]: Lưu thống kê trực tiếp lên CMS API.
- `src/components/common/BroadcastModal.tsx` [MODIFY]: Gửi broadcast thật qua notificationsApi.
- `src/components/EventModal.tsx` [MODIFY]: Gửi RSVP trực tiếp vào DB qua eventsApi.
- `src/components/dev/DevUserSwitcher.tsx` [MODIFY]: Cập nhật import auth.types.ts.
- `src/components/guards/ActionGuard.tsx` [MODIFY]: Cập nhật import auth.types.ts.
- `src/components/layout/Sidebar.tsx` [MODIFY]: Cập nhật import auth.types.ts.
- `src/components/hr/MemberModal.tsx` [MODIFY]: Cập nhật import auth.types.ts.
- `src/App.tsx` [MODIFY]: Cập nhật import auth.types.ts và fetch CMS tự động trên Landing Page.

---

## 2. Kiến Trúc Luồng Nghiệp Vụ (Business Logic Flow)

```mermaid
flowchart TD
    subgraph Frontend ["Frontend (Vite + React + Zustand)"]
        UI["React Component (Dashboard / TaskBoard / EventAttendance / AssetHub)"]
        Store["Zustand Store (useMemberStore, useGenerationStore, useNotificationStore)"]
        APIModule["API Module (src/api/modules/*.api.ts)"]
        HTTPClient["HTTP Client (src/api/client.ts)"]
    end

    subgraph Backend ["Backend (NestJS + Prisma)"]
        Controller["NestJS Controller (/api/*)"]
        Guard["JwtAuthGuard / RolesGuard (Cookie: session_token)"]
        Interceptor["TransformInterceptor ({ data, message })"]
        Service["Domain Service (*.service.ts)"]
        Prisma["Prisma ORM (schema.prisma)"]
        DB[(PostgreSQL Database)]
    end

    UI -->|1. Dispatch Action| Store
    Store -->|2. Invoke Method| APIModule
    UI -.->|Direct Call (nếu cần)| APIModule
    APIModule -->|3. Make Request (credentials: include)| HTTPClient
    HTTPClient -->|4. HTTP Request| Controller
    Controller --> Guard
    Guard --> Service
    Service --> Prisma
    Prisma --> DB
    Service --> Interceptor
    Interceptor -->|5. HTTP Response { data: ... }| HTTPClient
    HTTPClient -->|6. Unwrap Data| Store
    Store -->|7. Update Reactive State| UI
```

---

## 3. Tài Liệu Tham Khảo Chính Thống (Official References)

1. **NestJS Interceptors & Response Mapping**: [NestJS Official Documentation - Interceptors](https://docs.nestjs.com/interceptors)
2. **Fetch API & HttpOnly Cookie Authentication**: [MDN Web Docs - Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
3. **Zustand State Management Best Practices**: [Zustand Documentation](https://zustand.docs.pmnd.rs/guides/updating-state)
4. **Prisma Client CRUD Operations**: [Prisma Documentation - CRUD](https://www.prisma.io/docs/concepts/components/prisma-client/crud)
