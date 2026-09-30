# Kế hoạch Thực hiện Sprint 06 (Implementation Plan)
**Phân hệ:** Quản lý Kho Vật Tư & Trung Tâm Thông Báo (Inventory & Notifications Hub)  
**Thời gian thực hiện:** 23/09/2026 (Block 50 phút)  
**Người phụ trách:** Web Lead + AI Co-Pilot  

---

## 1. Mục tiêu & Bối cảnh (Objectives & Context)

Xây dựng toàn diện 2 module quản trị hậu cần và truyền thông nội bộ cho GDGoC Portal:
1. **Quản lý Kho Vật tư & Tài sản CLB (`InventoryModule`)**:
   - Quản lý tài sản (Standee, Mic không dây, Thiết bị kỹ thuật), quà tặng (Áo, bình nước, sticker), và vật tư tiêu hao.
   - Ghi nhận chính xác số lượng (`quantity`), người đang nắm giữ (`holderName`, `holderUserId`), ngày bàn giao (`assignedDate`), và ghi chú tình trạng (`notes`).
   - Phân quyền chuyên trách: Quyền quản lý thuộc về Ban Chủ Nhiệm (`LEAD`) và Ban Nhân sự & Sự kiện (`HR_EVENT`).
2. **Trung Tâm Thông Báo Nội Bộ (`NotificationsModule`)**:
   - Phát thông báo toàn CLB (Broadcast) hoặc phát riêng cho từng Ban chuyên môn (`targetDepartmentCode`).
   - Phân loại thông báo (`TASK`, `EVENT`, `GEMS`, `BROADCAST`, `SYSTEM`) và mức độ khẩn cấp (`NORMAL`, `IMPORTANT`, `URGENT`).
   - Hệ thống theo dõi trạng thái đã đọc cá nhân hóa cho từng user qua bảng pivot `NotificationRead`.
   - Tính năng đánh dấu đã đọc từng thông báo (`PATCH /notifications/:id/read`) hoặc đọc tất cả (`PATCH /notifications/read-all`).

---

## 2. Tiêu chuẩn Bảo mật & Môi trường (Security & Compliance Mandates)

- 🔒 **Không hardcode biến môi trường / Secrets**: Đọc cấu hình hoàn toàn qua `ConfigService`.
- 🍪 **Xác thực Cookie an toàn**: Mọi request nội bộ bắt buộc đi qua `JwtAuthGuard` (HttpOnly Cookie `session_token`).
- ⚡ **Phân quyền RBAC nghiêm ngặt**:
  - **Kho vật tư (`Inventory`)**:
    - `GET /inventory`: `LEAD`, `ADVISOR`, và thành viên ban `HR_EVENT`.
    - `POST & PUT /inventory`: `LEAD` và `DEPARTMENT_LEAD` của ban `HR_EVENT`.
    - `DELETE /inventory/:id`: Độc quyền `LEAD`.
  - **Thông báo (`Notifications`)**:
    - `GET /notifications`: Mọi thành viên đã đăng nhập (chỉ nhận thông báo broadcast hoặc thông báo gửi riêng cho ban của mình).
    - `POST /notifications`: `LEAD` (gửi toàn CLB hoặc ban bất kỳ), `DEPARTMENT_LEAD` (chỉ được gửi cho ban của mình).
    - `DELETE /notifications/:id`: `LEAD` hoặc người gửi (`senderId`).

---

## 3. Kiến trúc Kỹ thuật & Chi tiết Triển khai (Technical Design)

### 3.1. Cấu trúc Module (`InventoryModule` & `NotificationsModule`)
```
backend/src/modules/
├── inventory/
│   ├── dto/
│   │   ├── create-inventory-item.dto.ts   # DTO tạo vật tư mới
│   │   ├── update-inventory-item.dto.ts   # DTO cập nhật vật tư
│   │   └── query-inventory.dto.ts         # DTO tìm kiếm, lọc theo phân loại & người giữ
│   ├── inventory.controller.ts            # Controller RESTful chuẩn API Contract
│   ├── inventory.service.ts               # Service xử lý CRUD & kiểm kê kho
│   └── inventory.module.ts                # Module NestJS kết nối Prisma & Auth
└── notifications/
    ├── dto/
    │   ├── create-notification.dto.ts     # DTO gửi thông báo (title, message, type, priority, targetDepartmentCode)
    │   └── query-notifications.dto.ts     # DTO lọc thông báo (type, unreadOnly, page, limit)
    ├── notifications.controller.ts        # Controller RESTful thông báo & đánh dấu đã đọc
    ├── notifications.service.ts           # Service phân phối thông báo, đếm unread & đánh dấu đọc
    └── notifications.module.ts            # Module NestJS kết nối Prisma & Auth
```

### 3.2. Đặc tả Chi tiết Endpoints

#### 1. `GET /api/inventory`
- **Auth:** `JwtAuthGuard`, `RolesGuard` (`LEAD`, `ADVISOR`, `HR_EVENT`)
- **Query DTO (`QueryInventoryDto`)**: `category?: string`, `search?: string`, `page?: number = 1`, `limit?: number = 20`
- **Response**: `{ items: [InventoryItem], total: number, page: number, limit: number, totalPages: number }`

#### 2. `POST /api/inventory` & `PUT /api/inventory/:id` & `DELETE /api/inventory/:id`
- **Auth:** `POST & PUT` (`LEAD`, `DEPARTMENT_LEAD` của `HR_EVENT`), `DELETE` (`LEAD` only)
- **Body DTO (`CreateInventoryItemDto`)**:
  - `name: string` (bắt buộc)
  - `category: string` (ví dụ: "Asset" | "Gift" | "Consumable")
  - `quantity: number` (>= 0)
  - `holderName: string` (tên người giữ hoặc "Kho CLB")
  - `holderUserId?: string` (UUID thành viên giữ nếu có)
  - `notes?: string`

#### 3. `GET /api/notifications`
- **Auth:** `JwtAuthGuard`
- **Logic Service**:
  - Xác định ban (`departmentId`) của user hiện tại.
  - Lấy các thông báo có `targetDepartmentId === null` (Broadcast) HOẶC `targetDepartmentId === userDepartmentId`.
  - Kết nối bảng `NotificationRead` để xác định `isRead` (`reads.length > 0`).
  - Đếm `unreadCount` tổng số thông báo chưa đọc của user.
  - Response format chuẩn API Contract:
    ```json
    {
      "unreadCount": 3,
      "items": [
        {
          "id": "uuid",
          "title": "string",
          "message": "string",
          "type": "BROADCAST",
          "priority": "URGENT",
          "isRead": false,
          "createdAt": "...",
          "link": "...",
          "sender": { "id": "...", "fullName": "...", "avatarUrl": "..." }
        }
      ]
    }
    ```

#### 4. `POST /api/notifications`
- **Auth:** `JwtAuthGuard`, `RolesGuard` (`LEAD`, `DEPARTMENT_LEAD`)
- **Body DTO (`CreateNotificationDto`)**:
  - `title: string`
  - `message: string`
  - `type?: NotificationType` (mặc định `BROADCAST`)
  - `priority?: NotificationPriority` (mặc định `NORMAL`)
  - `targetDepartmentCode?: string` ("all" hoặc mã ban `TECH_AI`, `HR_EVENT`...)
  - `link?: string`
- **Logic Service**:
  - Resolve `targetDepartmentCode` sang `targetDepartmentId` (hoặc `null` nếu là "all").
  - Phân quyền: `DEPARTMENT_LEAD` chỉ được gửi thông báo cho chính ban của mình.

#### 5. `PATCH /api/notifications/:id/read`
- **Auth:** `JwtAuthGuard`
- **Logic**: Tạo bản ghi `NotificationRead` (`notificationId`, `userId`, `readAt: new Date()`) với `upsert` để tránh trùng lặp.

#### 6. `PATCH /api/notifications/read-all`
- **Auth:** `JwtAuthGuard`
- **Logic**: Tìm tất cả thông báo áp dụng cho user mà chưa có trong `NotificationRead`, tạo hàng loạt `NotificationRead` bằng `createMany`.

#### 7. `DELETE /api/notifications/:id`
- **Auth:** `JwtAuthGuard`
- **Logic**: Chỉ `LEAD` hoặc người gửi (`senderId === user.id`) mới được xóa thông báo.

---

## 4. Kế hoạch Kiểm thử & Nghiệm thu (Verification Plan)

### 4.1. Automated Build Check
- Chạy `npm run build` đảm bảo không có lỗi kiểu dữ liệu TypeScript.

### 4.2. Functional & RBAC Verification
1. **Kiểm tra Phân quyền Kho**: Đăng nhập role `MEMBER` ban Tech gọi `GET /api/inventory` -> Nhận 403 Forbidden. Đăng nhập `HR_EVENT` hoặc `LEAD` -> Truy cập thành công.
2. **Kiểm tra Tạo & Cập nhật Vật tư**: Thêm mới Mic không dây, gán người giữ `holderName` -> Thành công.
3. **Kiểm tra Phát Thông Báo Broadcast & Ban**:
   - `LEAD` gửi thông báo Broadcast "all" -> Mọi thành viên nhận được.
   - `DEPARTMENT_LEAD` ban AI gửi thông báo riêng cho `TECH_AI` -> Thành viên ban AI nhận được, thành viên ban Web không nhận được.
4. **Kiểm tra Đọc Thông Báo**:
   - Gọi `GET /notifications` -> `unreadCount` chính xác.
   - Gọi `PATCH /notifications/:id/read` -> `isRead: true`, `unreadCount` giảm 1.
   - Gọi `PATCH /notifications/read-all` -> Toàn bộ chuyển sang đã đọc, `unreadCount = 0`.
