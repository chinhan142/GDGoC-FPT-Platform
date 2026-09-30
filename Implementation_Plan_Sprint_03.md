# Kế hoạch Thực hiện Sprint 03 (Implementation Plan)
**Phân hệ:** Module Sự Kiện & Điểm Danh (Events & Attendance Engine)  
**Thời gian thực hiện:** 23/09/2026 (Block 50 phút)  
**Người phụ trách:** Web Lead + AI Co-Pilot  

---

## 1. Mục tiêu & Bối cảnh (Objectives & Context)

Xây dựng toàn diện phân hệ **Sự Kiện & Điểm Danh (`EventsModule`)** cho GDGoC Portal phục vụ quản lý sự kiện nội bộ, Landing Page công khai, và công cụ điểm danh trực tiếp tại bàn sự kiện của ban Nhân sự & Sự kiện (`HR_EVENT`).

### 🎯 Các Mục Tiêu Nghiệp Vụ Trọng Tâm:
1. **Danh sách sự kiện đa năng (`GET /api/events`)**:
   - Lọc theo `tenureId` (mặc định kỳ active), `isPublic` (cho Landing Page), `type` (`EventType`), `status` (`upcoming`, `registration_open`, `completed`).
   - Tự động thống kê `attendeeCount` và `checkedInCount` cho mỗi sự kiện.
2. **Quản lý Vòng đời Sự kiện (`POST`, `PUT`, `DELETE /api/events`)**:
   - `POST /api/events` & `PUT /api/events/:id`: Cho phép `LEAD` và `DEPARTMENT_LEAD` của `HR_EVENT` tạo và cập nhật sự kiện (`bannerImageUrl`, `registrationUrl`, `attendeeGems`, `organizerGems`, `isPublic`).
   - `DELETE /api/events/:id`: Chỉ `LEAD` được xóa sự kiện (cascade xóa attendances & organizers).
3. **Danh sách người tham dự & Thống kê điểm danh (`GET /api/events/:id/attendees`)**:
   - Trả về danh sách người tham dự kèm tỷ lệ điểm danh `attendanceRate` (`(totalCheckedIn / totalRegistered) * 100%`).
   - Phân quyền: `LEAD`, `ADVISOR`, và thành viên ban `HR_EVENT`.
4. **Thêm người tham dự / Check-in tay tại bàn (`POST /api/events/:id/attendees`)**:
   - Dành cho `LEAD` và ban `HR_EVENT`. Hỗ trợ check-in cho thành viên CLB (`userId`) hoặc khách mời/sinh viên ngoài CLB.
5. **Toggle trạng thái điểm danh (`PATCH /api/events/:id/attendees/:attendeeId/checkin`)**:
   - Phân quyền độc quyền: Chỉ `LEAD` và ban `HR_EVENT` (`DEPARTMENT_LEAD` và `MEMBER` trong `HR_EVENT`). Các role khác (`BAN_LEAD`, `BAN_MEMBER`, `ADVISOR`) bị từ chối 403 Forbidden.
   - Khi check-in thành công: Tự động ghi nhận thời gian và người xác nhận (`verifiedById`).
6. **Xóa người tham dự (`DELETE /api/events/:id/attendees/:attendeeId`)**:
   - Dành cho `LEAD` và `DEPARTMENT_LEAD` của `HR_EVENT`.
7. **Ban Tổ Chức & Quyết Toán Gems BTC (`/api/events/:eventId/organizers`)**:
   - Quản lý phân công ban tổ chức và quyết toán thưởng Gems cho BTC (`settle-gems`) với cơ chế `idempotencyKey` chống gian lận.

---

## 2. Tiêu chuẩn Bảo mật & Môi trường (Security & Compliance Mandates)

- 🔒 **Không hardcode biến môi trường**: Tuyệt đối đọc thông tin nhạy cảm qua `ConfigService`.
- 🍪 **Xác thực Cookie an toàn**: Áp dụng `JwtAuthGuard` (HttpOnly Cookie `session_token`) cho các endpoint nội bộ và mở `@Public()` cho Landing Page.
- ⚡ **Phân quyền RBAC nghiêm ngặt**:
  - `POST /events`, `PUT /events/:id`: `LEAD` hoặc `DEPARTMENT_LEAD` của ban `HR_EVENT`.
  - `DELETE /events/:id`: Chỉ `LEAD`.
  - Check-in endpoints: Độc quyền cho `LEAD` và ban `HR_EVENT`.

---

## 3. Kiến trúc Kỹ thuật & Chi tiết Triển khai (Technical Design)

### 3.1. Cấu trúc Module (`EventsModule`)
```
backend/src/modules/events/
├── dto/
│   ├── query-event.dto.ts            # Query lọc sự kiện
│   ├── create-event.dto.ts           # DTO tạo sự kiện mới
│   ├── update-event.dto.ts           # DTO cập nhật sự kiện
│   ├── add-attendee.dto.ts           # DTO thêm người tham dự (manual checkin)
│   ├── toggle-checkin.dto.ts         # DTO toggle trạng thái checkin
│   └── add-event-organizer.dto.ts    # DTO gán BTC sự kiện
├── guards/
│   └── hr-event.guard.ts             # Custom Guard kiểm tra quyền ban HR_EVENT
├── events.controller.ts              # Controller RESTful chuẩn API Contract
├── events.service.ts                 # Service xử lý logic sự kiện & điểm danh
└── events.module.ts                  # Module kết nối Prisma & Auth
```

### 3.2. Chi tiết các DTO & Endpoints

#### 1. `GET /api/events`
- **Query DTO (`QueryEventDto`)**:
  - `tenureId?: string`
  - `isPublic?: boolean`
  - `type?: EventType`
  - `status?: 'upcoming' | 'registration_open' | 'completed'`
  - `search?: string`
- **Logic Service**:
  - Lọc theo thời gian `startTime`, `endTime`.
  - Đếm `attendeeCount` và `checkedInCount` bằng Prisma `_count` hoặc `include: { attendances: true }`.

#### 2. `POST /api/events/:id/attendees`
- **Body DTO (`AddAttendeeDto`)**:
  - `userId?: string`
  - `guestName?: string`
  - `guestMssv?: string`
  - `guestEmail?: string`
  - `guestDepartment?: string`
  - `checkinMethod?: CheckinMethod` (default `MANUAL_EVIDENCE`)
  - `isVerified?: boolean` (default `true`)
  - `notes?: string`

#### 3. `PATCH /api/events/:id/attendees/:attendeeId/checkin`
- **Body DTO (`ToggleCheckinDto`)**:
  - `checkedIn: boolean`
  - `evidenceImageUrl?: string`
  - `notes?: string`

---

## 4. Kế hoạch Kiểm thử & Nghiệm thu (Verification Plan)

### 4.1. Automated Compilation Check
- Chạy `npm run build` để đảm bảo code TypeScript chặt chẽ, không lỗi type.

### 4.2. Endpoint Verification Checklist
1. `GET /api/events` (Public vs Internal mode, kiểm tra bộ đếm `attendeeCount`).
2. `POST /api/events` tạo sự kiện mới với role `LEAD` và `HR_EVENT` Lead.
3. `PUT /api/events/:id` cập nhật thông tin sự kiện.
4. `GET /api/events/:id/attendees` kiểm tra tính toán `attendanceRate`.
5. `POST /api/events/:id/attendees` check-in thủ công tại bàn.
6. `PATCH /api/events/:id/attendees/:attendeeId/checkin` toggle check-in và kiểm tra chặn 403 với role ngoài ban `HR_EVENT`.
7. `DELETE /api/events/:id` kiểm tra chỉ role `LEAD` được xóa.
8. Kiểm tra Swagger UI tại `http://localhost:8080/api/docs`.
