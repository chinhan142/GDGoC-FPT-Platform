# 🧐 GDGoC Platform — Hướng Dẫn Nghiệm Thu Code Sprint 03 (Review Guide)
**Dành cho:** Web Lead  
**Phân hệ:** Module Sự Kiện & Điểm Danh (Events & Attendance Engine)  
**Thời gian:** 23/09/2026  

---

## 🎯 1. Thứ Tự Rà Soát Code Logic (Bottom-Up Review Flow)

Vui lòng duyệt qua các tệp mã nguồn theo thứ tự từ dưới lên:

```
1. Guards & DTOs
   ├── hr-event.guard.ts
   ├── query-event.dto.ts
   ├── create-event.dto.ts
   ├── update-event.dto.ts
   ├── add-attendee.dto.ts
   └── toggle-checkin.dto.ts
   
2. Business Logic Layer
   └── events.service.ts
   
3. Controller & Routing Layer
   └── events.controller.ts
```

---

## 🔍 2. Checklist Các Điểm Kỹ Thuật & Nghiệp Vụ Cần Soi Kỹ

### 🛡️ A. Bảo mật & Phân quyền
- [x] **Phân quyền độc quyền cho `HR_EVENT`**: `HrEventGuard` kiểm tra `activeTenure.department.code === 'HR_EVENT'` hoặc role `LEAD`. Mọi role khác (kể cả ban Tech/Media hay Cố vấn) gọi vào endpoint check-in đều bị từ chối 403 Forbidden.
- [x] **Xóa sự kiện**: Chỉ duy nhất role `LEAD` mới có quyền `DELETE /api/events/:id`.
- [x] **Idempotency trong Quyết toán Gems**: `settleOrganizerGems` sử dụng khóa giao dịch duy nhất `event-organizer:${eventId}:${userId}` trong Prisma Transaction.

### ⚡ B. Xử lý Dữ liệu & Thống kê
- [x] **Thống kê người tham gia**: `GET /api/events` tự động tính `attendeeCount` và `checkedInCount`.
- [x] **Tỷ lệ điểm danh**: `GET /api/events/:id/attendees` trả về `attendanceRate` dạng phần trăm chính xác.
- [x] **Hỗ trợ khách mời ngoài CLB**: `addAttendee` tự động xử lý khi truyền thông tin khách ngoài mà không có `userId`.

---

## 🧪 3. Kịch Bản Kiểm Thử Nhanh (Step-by-Step Test Scenarios)

### 🔹 Bước 1: Khởi động Server
```powershell
cd d:\GDG-Management\backend
npm run start:dev
```
Truy cập Swagger Docs tại: **`http://localhost:8080/api/docs`**

---

### 🔹 Bước 2: Test Tạo Sự Kiện Mới (`POST /api/events`)
**Tài khoản:** Đăng nhập role `LEAD` hoặc `DEPARTMENT_LEAD` của `HR_EVENT`.  
**Payload mẫu:**
```json
{
  "title": "Google Cloud Study Jam 2026",
  "description": "Workshop thực hành triển khai ứng dụng trên Google Cloud Platform",
  "type": "WORKSHOP",
  "location": "Hội trường Edison, ĐH FPT",
  "startTime": "2026-10-15T08:00:00.000Z",
  "endTime": "2026-10-15T12:00:00.000Z",
  "attendeeGems": 30,
  "organizerGems": 100,
  "isPublic": true,
  "registrationUrl": "https://forms.gle/cloudstudyjam",
  "tenureId": "<ID_TENURE_ACTIVE>"
}
```
👉 **Kỳ vọng:** Trả về HTTP 201 kèm thông tin sự kiện và bộ đếm `attendeeCount: 0`, `checkedInCount: 0`.

---

### 🔹 Bước 3: Test Lấy Danh Sách Sự Kiện (`GET /api/events`)
Thử các truy vấn:
1. `GET /api/events` (Tất cả sự kiện)
2. `GET /api/events?isPublic=true` (Sự kiện công khai cho Landing Page)
3. `GET /api/events?status=upcoming` (Sự kiện sắp diễn ra)
👉 **Kỳ vọng:** Trả về danh sách sự kiện kèm `attendeeCount` và `checkedInCount`.

---

### 🔹 Bước 4: Test Thêm Người Tham Dự Tại Bàn (`POST /api/events/:id/attendees`)
**Payload mẫu (Thành viên CLB):**
```json
{
  "userId": "<MEMBER_USER_ID>",
  "checkinMethod": "MANUAL_EVIDENCE",
  "isVerified": true,
  "notes": "Điểm danh trực tiếp tại bàn sảnh Hall A"
}
```
👉 **Kỳ vọng:** Trả về HTTP 201 bản ghi `EventAttendance`.

---

### 🔹 Bước 5: Test Lấy Danh Sách Điểm Danh & Tỷ Lệ (`GET /api/events/:id/attendees`)
👉 **Kỳ vọng:** Trả về cấu trúc:
```json
{
  "eventId": "<EVENT_ID>",
  "totalRegistered": 1,
  "totalCheckedIn": 1,
  "attendanceRate": 100,
  "attendees": [ ... ]
}
```

---

### 🔹 Bước 6: Test Chặn Phân Quyền Check-in (403 Forbidden)
Đăng nhập với tài khoản của ban khác (ví dụ: `TECH_AI` hoặc `MEDIA`) và gọi `PATCH /api/events/:id/attendees/:attendeeId/checkin`.  
👉 **Kỳ vọng:** Trả về **HTTP 403 Forbidden** kèm thông báo từ chối truy cập.
