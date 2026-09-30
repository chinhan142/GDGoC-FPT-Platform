# 🧐 GDGoC Platform — Hướng Dẫn Nghiệm Thu Code Sprint 06 (Review Guide)
**Dành cho:** Web Lead  
**Phân hệ:** Quản lý Kho Vật Tư & Trung Tâm Thông Báo (Inventory & Notifications Hub)  
**Thời gian:** 23/09/2026  

---

## 🎯 1. Thứ Tự Rà Soát Code Logic (Bottom-Up Review Flow)

Vui lòng duyệt qua các tệp mã nguồn theo thứ tự từ dưới lên:

```
1. Inventory Module
   ├── dto/
   │   ├── create-inventory-item.dto.ts
   │   ├── update-inventory-item.dto.ts
   │   └── query-inventory.dto.ts
   ├── guards/
   │   └── inventory.guard.ts
   ├── inventory.service.ts
   ├── inventory.controller.ts
   └── inventory.module.ts

2. Notifications Module
   ├── dto/
   │   ├── create-notification.dto.ts
   │   └── query-notifications.dto.ts
   ├── notifications.service.ts
   ├── notifications.controller.ts
   └── notifications.module.ts
```

---

## 🔍 2. Checklist Các Điểm Kỹ Thuật & Nghiệp Vụ Cần Soi Kỹ

### 🛡️ A. Bảo mật & Phân quyền RBAC
- [x] **Phân quyền Kho Vật tư (`InventoryGuard`)**: `GET` cho `LEAD`, `ADVISOR`, `HR_EVENT`; `POST/PUT` cho `LEAD`, `HR_EVENT Lead`; `DELETE` chỉ `LEAD`. Các ban Tech/Media bị từ chối 403 Forbidden.
- [x] **Phân quyền Phát Thông Báo**: Chỉ `LEAD` mới có quyền phát broadcast toàn CLB (`targetDepartmentCode: "all"`). `DEPARTMENT_LEAD` chỉ được gửi thông báo cho ban mình.
- [x] **Xóa Thông Báo An Toàn**: Chỉ `LEAD` hoặc người gửi gốc (`senderId`) mới có quyền xóa.

### ⚡ B. Hiệu năng & Trải nghiệm Thông Báo
- [x] **Đếm số lượng chưa đọc (`unreadCount`)**: Truy vấn chính xác dựa trên các thông báo áp dụng cho user mà chưa có bản ghi trong bảng `NotificationRead`.
- [x] **Bulk Read (`markAllAsRead`)**: Sử dụng `createMany` với `skipDuplicates: true` xử lý đánh dấu đọc toàn bộ trong 1 query duy nhất.
- [x] **Tìm kiếm vật tư đa trường**: Hỗ trợ tìm theo tên món đồ, người đang giữ (`holderName`), hoặc ghi chú (`notes`).

---

## 🧪 3. Kịch Bản Kiểm Thử Nhanh (Step-by-Step Test Scenarios)

### 🔹 Bước 1: Khởi động Server
```powershell
cd d:\GDG-Management\backend
npm run start:dev
```
Truy cập Swagger Docs tại: **`http://localhost:8080/api/docs`**

---

### 🔹 Bước 2: Test Thêm Vật Tư Mới (`POST /api/inventory`)
**Tài khoản:** `LEAD` hoặc `DEPARTMENT_LEAD` của `HR_EVENT`.  
**Payload mẫu:**
```json
{
  "name": "Standee Google Developer Groups 2026",
  "category": "Asset",
  "quantity": 3,
  "holderName": "Lưu tại tủ đồ CLB (Beta 402)",
  "notes": "Standee chữ X kích thước 0.8m x 1.8m"
}
```
👉 **Kỳ vọng:** Trả về HTTP 201 bản ghi `InventoryItem`.

---

### 🔹 Bước 3: Test Xem Danh Mục Kho (`GET /api/inventory`)
Thử truy cập bằng tài khoản `MEMBER` ban AI -> Nhận HTTP 403 Forbidden.  
Thử truy cập bằng tài khoản ban `HR_EVENT` hoặc `LEAD` -> Trả về HTTP 200 danh sách vật tư.

---

### 🔹 Bước 4: Test Phát Thông Báo Broadcast (`POST /api/notifications`)
**Tài khoản:** `LEAD`  
**Payload mẫu:**
```json
{
  "title": "Thông báo Họp Toàn Thể CLB Đầu Kỳ Fall 2026",
  "message": "Toàn thể thành viên có mặt tại Hội trường Innovation lúc 18h00 thứ Sáu ngày 25/09",
  "type": "BROADCAST",
  "priority": "URGENT",
  "targetDepartmentCode": "all",
  "link": "/app/events"
}
```
👉 **Kỳ vọng:** Trả về HTTP 201 bản ghi `Notification` với `targetDepartmentId: null`.

---

### 🔹 Bước 5: Test Lấy Danh Sách Thông Báo & Đếm Chưa Đọc (`GET /api/notifications`)
**Tài khoản:** Bất kỳ Member.  
👉 **Kỳ vọng:** Trả về danh sách thông báo có `isRead: false` và `unreadCount >= 1`.

---

### 🔹 Bước 6: Test Đánh Dấu Đã Đọc (`PATCH /api/notifications/:id/read` & `PATCH /api/notifications/read-all`)
1. Gọi `PATCH /api/notifications/:id/read` -> Thông báo chuyển thành `isRead: true`, `unreadCount` giảm 1.
2. Gọi `PATCH /api/notifications/read-all` -> Toàn bộ chuyển sang đã đọc, `unreadCount = 0`.
