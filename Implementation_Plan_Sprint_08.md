# Kế hoạch Thực hiện Sprint 08 (Implementation Plan)
**Phân hệ:** Tích Hợp Hệ Thống & Kiểm Thử Toàn Diện (Integration & End-to-End Test)  
**Mô hình dự án:** Đa kho lưu trữ (Multi-Repo Architecture)  
- **Backend Repo:** `chinhan142/GDGoC-FPT-Platform` (`d:\GDG-Management`)
- **Frontend Repo:** `plozdev/gdgoc-fptu-portal` (`d:\GDG-Management-FE`)  
- **Tài liệu đặc tả:** `D:\GDG-Management-Internal Docs\`  
**Thời gian thực hiện:** 23/09/2026 (Block 50 phút)  
**Người phụ trách:** Web Lead + AI Co-Pilot  

---

## 1. Mục tiêu & Bối cảnh (Objectives & Context)

Do dự án tổ chức theo mô hình **Multi-Repo độc lập**:
- Phía **Backend** đã hoàn thành 100% (Sprint 01 -> 07), cung cấp hệ thống REST API chuẩn RFC, bảo mật HttpOnly Cookie (`session_token`), hỗ trợ CORS cho FE dev server, và tài liệu Swagger UI tại `http://localhost:8080/api/docs`.
- Phía **Frontend** (do Frontend Lead quản lý) cần được kết nối qua Vite Proxy hoặc Direct API calls, gỡ bỏ Mock MSW, và chuyển đổi các Zustand stores sang gọi Real API.

### 🎯 Các Mục Tiêu Sprint 08:
1. **Chuẩn hóa Giao thức Kết Nối Giữa 2 Repos**:
   - Backend cấu hình CORS cho phép `credentials: true` và whitelist origins (`http://localhost:5173`, `http://localhost:3000`).
   - Frontend cấu hình `vite.config.ts` proxy `/api` trỏ về Backend (`http://localhost:8080`).
2. **Xây Dựng Bộ API Client Chuẩn Cho Repo Frontend (`d:\GDG-Management-FE`)**:
   - Tạo `src/api/client.ts` tự động gửi Cookie `session_token` (`credentials: 'include'`).
   - Tạo các module API tương ứng với `API_CONTRACT.md`: Auth, Members, Events, Tasks, Gems, Gifts, Inventory, Notifications, Generation, CMS.
3. **Chuyển Đổi Stores Frontend Từ Mock Sang Real API**:
   - Tắt MSW trong `src/main.tsx`.
   - Kết nối `useAuthStore`, `useMemberStore`, `useInventoryStore`, `useNotificationStore`, `useGenerationStore` với backend thật.
4. **Kiểm Thử E2E Toàn Bộ Luồng Nghiệp Vụ**:
   - Chạy đồng thời BE (8080) và FE (5173).
   - Xác minh thông luồng trơn tru 10 màn hình chức năng.

---

## 2. Tiêu chuẩn Phân Quyền & Quy Trình Git Multi-Repo

- 🌿 **Git Phía Frontend (`d:\GDG-Management-FE`)**:
  - Tạo nhánh riêng: `feat/sprint-08-integration-e2e`.
  - Commit rõ ràng từng phần để Frontend Lead đối tác dễ dàng review và merge.
- 🌿 **Git Phía Backend (`d:\GDG-Management`)**:
  - Đảm bảo nhánh `feat/sprint-07-config-drive-cms` hoặc `main` đã sẵn sàng phục vụ.

---

## 3. Kiến trúc Kỹ thuật Chi Tiết

### 3.1. Cấu hình CORS Backend (`backend/src/main.ts`)
```typescript
app.enableCors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
});
```

### 3.2. Cấu trúc Tệp Tích Hợp Trên Repo Frontend (`d:\GDG-Management-FE`)
```
frontend/src/
├── api/
│   ├── client.ts                     # HTTP fetch wrapper (credentials: 'include')
│   ├── auth.api.ts                   # Login, Me, Logout
│   ├── members.api.ts                # CRUD Members, Excel Import, Profile, Organizers
│   ├── events.api.ts                 # Events, Attendees, Check-in
│   ├── tasks.api.ts                  # Tasks Kanban, Status, Submit, Approve
│   ├── gems.api.ts                   # Leaderboard, Transactions, Adjust
│   ├── gifts.api.ts                  # Gift Items, Redeem, Redemptions
│   ├── inventory.api.ts              # Inventory CRUD
│   ├── notifications.api.ts          # Notifications, Read-all
│   ├── generation.api.ts             # Generation config, Transition
│   └── cms.api.ts                    # Landing stats & Public events
├── store/                            # Cập nhật các Zustand stores kết nối real API
├── main.tsx                          # Tắt Mock Service Worker
└── vite.config.ts                    # Proxy /api -> http://localhost:8080
```

---

## 4. Kế hoạch Kiểm thử & Nghiệm thu (Verification Plan)

### 4.1. Automated Compilation Check
- Backend: `npm run build` (Exit code 0).
- Frontend: `npm run build` (Exit code 0).

### 4.2. Kịch Bản Test Thông Luồng E2E
1. Mở Landing Page FE -> Load dữ liệu CMS & Public Events từ BE thật.
2. Đăng nhập qua Form Login FE -> Nhận HttpOnly Cookie từ BE -> Chuyển vào Dashboard.
3. Test CRUD Member, Import Excel `.xlsx`, Check-in sự kiện, Kéo thả Kanban task, Đổi quà tặng, Phát thông báo broadcast.
