# GDGoC FPTU HCMC Portal — API Contract

**Phiên bản:** v1.0  
**Cập nhật:** 16/09/2026  
**Mô tả:** Đặc tả toàn bộ REST API endpoints mà Backend cần implement để Frontend kết nối.  
**Base URL:** `https://api.gdgoc-fptu.dev/api` (production) hoặc `http://localhost:8080/api` (dev)

---

## Quy ước chung

### Authentication
Tất cả endpoint (trừ `POST /auth/login`) yêu cầu xác thực bằng **HttpOnly Cookie** (`session_token`).  
Backend validate cookie, resolve ra `userId` → đính kèm vào request context.

### Response Format
```json
// Success
{ "data": <payload>, "message": "Success" }

// Error
{ "error": "<error_code>", "message": "<human-readable message>" }
```

### HTTP Status Codes
| Code | Ý nghĩa |
|------|---------|
| `200` | OK |
| `201` | Created |
| `204` | No Content (xóa thành công) |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized (chưa đăng nhập) |
| `403` | Forbidden (không đủ quyền) |
| `404` | Not Found |
| `409` | Conflict (duplicate, etc.) |
| `500` | Internal Server Error |

### RBAC — Phân quyền
| Role | Mô tả | Quyền |
|------|-------|-------|
| `ADVISOR` | Cố vấn CLB | View-only toàn bộ |
| `LEAD` | Ban Chủ Nhiệm | Full access |
| `DEPARTMENT_LEAD` | Trưởng Ban | Full access trong ban của mình |
| `MEMBER` | Thành viên | Xem + tự cập nhật profile, submit task |
| `COLLABORATOR` | CTV/Thử việc | Xem hạn chế |

---

## 1. Authentication

### `POST /auth/login`
Đăng nhập bằng email FPT + mật khẩu.  
**Auth:** Không yêu cầu

**Request Body:**
```json
{
  "email": "lead@fpt.edu.vn",
  "password": "string"
}
```

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "email": "lead@fpt.edu.vn",
    "fullName": "Đặng Mai Phương",
    "avatarUrl": "https://...",
    "currentTenure": {
      "role": "LEAD",
      "departmentCode": "EXECUTIVE",
      "departmentName": "Ban Chủ Nhiệm",
      "status": "ACTIVE"
    }
  }
}
```
> Backend set `HttpOnly Cookie: session_token=<jwt>` trong response headers.

---

### `GET /auth/me`
Lấy thông tin user session hiện tại.  
**Auth:** Session cookie

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "email": "string",
    "fullName": "string",
    "mssv": "SE180123",
    "avatarUrl": "string | null",
    "gemsBalance": 1250,
    "currentTenure": {
      "role": "DEPARTMENT_LEAD",
      "departmentCode": "HR_EVENT",
      "departmentName": "Ban Nhân Sự & Sự Kiện",
      "status": "ACTIVE",
      "position": "HR-Event Lead"
    }
  }
}
```

---

### `POST /auth/logout`
**Auth:** Session cookie  
**Response `200`:** `{ "message": "Logged out" }`  
> Backend clear `session_token` cookie.

---

## 2. Members (HR Management)

> **Quyền truy cập:** `LEAD` và `ADVISOR` xem tất cả. `DEPARTMENT_LEAD` xem trong ban mình.

### `GET /members`
Lấy danh sách thành viên.  
**Auth:** LEAD, ADVISOR, DEPARTMENT_LEAD

**Query params:**
| Param | Type | Mô tả |
|-------|------|-------|
| `tenureId` | string | Lọc theo nhiệm kỳ (default: current) |
| `departmentCode` | string | Lọc theo ban (TECH_AI, HR_EVENT, v.v.) |
| `status` | string | ACTIVE, ALUMNI, ON_LEAVE, PROBATION |
| `search` | string | Tìm kiếm theo tên, MSSV, email |
| `page` | number | Pagination (default: 1) |
| `limit` | number | Số item/trang (default: 50) |

**Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "mssv": "SE180123",
        "fullName": "Trần Nguyên Bảo",
        "email": "baotnse180123@fpt.edu.vn",
        "phoneNumber": "0903456789",
        "avatarUrl": "string | null",
        "tenure": {
          "role": "DEPARTMENT_LEAD",
          "departmentCode": "TECH_AI",
          "departmentName": "Ban Trí Tuệ Nhân Tạo",
          "position": "AI Lead",
          "status": "ACTIVE",
          "joinedAt": "2023-10-01T00:00:00Z"
        },
        "gemsBalance": 2400,
        "skills": ["Python", "Gemini API"],
        "bio": "string"
      }
    ],
    "total": 42,
    "page": 1,
    "totalPages": 1
  }
}
```

---

### `POST /members`
Thêm thành viên mới.  
**Auth:** LEAD only

**Request Body:**
```json
{
  "mssv": "SE210999",
  "fullName": "Nguyễn Văn B",
  "email": "bnvse210999@fpt.edu.vn",
  "phoneNumber": "0911111111",
  "departmentCode": "TECH_AI",
  "role": "MEMBER",
  "position": "AI Member",
  "tenureId": "uuid",
  "joinedAt": "2026-09-15"
}
```

**Response `201`:** `{ "data": <Member> }`

---

### `PUT /members/:id`
Cập nhật thông tin thành viên (HR admin).  
**Auth:** LEAD only  
**Request Body:** Partial member fields (role, status, position, departmentCode)  
**Response `200`:** `{ "data": <Member> }`

---

### `DELETE /members/:id`
Xóa thành viên khỏi kỳ hiện tại (soft delete → ALUMNI).  
**Auth:** LEAD only  
**Response `204`**

---

### `POST /members/import`
Bulk import thành viên từ Excel/CSV.  
**Auth:** LEAD only

**Request Body (multipart/form-data):**
```
file: <xlsx_file>
tenureId: "uuid"
defaultRole: "MEMBER"
departmentCode: "TECH_AI"
```

**Response `200`:**
```json
{
  "data": {
    "added": 15,
    "skipped": 2,
    "errors": ["Row 3: Email đã tồn tại", "Row 7: MSSV không hợp lệ"]
  }
}
```

---

### `PUT /members/:id/profile`
Thành viên tự cập nhật thông tin cá nhân của mình.  
**Auth:** Bất kỳ member (chỉ được sửa profile của chính mình)

**Request Body:**
```json
{
  "bio": "string",
  "phoneNumber": "string",
  "avatarUrl": "string",
  "skills": ["React", "TypeScript"],
  "githubUrl": "https://github.com/...",
  "linkedinUrl": "https://linkedin.com/in/...",
  "facebookUrl": "https://facebook.com/...",
  "discordUsername": "username#1234"
}
```

**Response `200`:** `{ "data": <Member> }`

---

### `GET /members/organizers`
Lấy danh sách organizers để hiển thị trên Landing Page.  
**Auth:** Không yêu cầu (public)

**Query params:** `featured=true` — Chỉ lấy những người có `isFeatured = true`

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "fullName": "Dang Mai Phuong",
      "position": "Chapter Lead Organizer",
      "avatarUrl": "https://...",
      "githubUrl": "https://...",
      "linkedinUrl": "https://...",
      "domain": "Leads"
    }
  ]
}
```

---

## 3. Events & Attendance

> **Quyền ghi:** Chỉ `LEAD` và `DEPARTMENT_LEAD` của `HR_EVENT` mới được tạo/sửa/xóa event và điểm danh.

### `GET /events`
Lấy danh sách sự kiện.  
**Auth:** Session cookie (internal list) | Public (nếu `isPublic=true`)

**Query params:**
| Param | Type | Mô tả |
|-------|------|-------|
| `tenureId` | string | Lọc theo kỳ |
| `isPublic` | boolean | Chỉ lấy event public (landing page) |
| `type` | string | WORKSHOP, HACKATHON, SHOWCASE, v.v. |
| `status` | string | upcoming, registration_open, completed |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Google I/O Extended FPT University 2026",
      "type": "FLAGSHIP",
      "location": "Hội trường Edison, ĐH FPT TP.HCM",
      "startTime": "2026-10-18T01:00:00Z",
      "endTime": "2026-10-18T10:00:00Z",
      "isPublic": true,
      "bannerImageUrl": "https://...",
      "description": "string",
      "registrationUrl": "https://...",
      "attendeeCount": 125,
      "checkedInCount": 98
    }
  ]
}
```

---

### `POST /events`
Tạo sự kiện mới.  
**Auth:** LEAD, HR_EVENT DEPARTMENT_LEAD

**Request Body:**
```json
{
  "title": "Build with AI Workshop",
  "type": "WORKSHOP",
  "location": "Lab Beta 402",
  "startTime": "2026-11-08T06:30:00Z",
  "endTime": "2026-11-08T10:30:00Z",
  "tenureId": "uuid",
  "attendeeGems": 20,
  "organizerGems": 100,
  "isPublic": true,
  "description": "string",
  "registrationUrl": "https://..."
}
```

**Response `201`:** `{ "data": <Event> }`

---

### `PUT /events/:id`
Cập nhật sự kiện.  
**Auth:** LEAD, HR_EVENT DEPARTMENT_LEAD  
**Response `200`:** `{ "data": <Event> }`

---

### `DELETE /events/:id`
Xóa sự kiện (và cascade xóa attendances).  
**Auth:** LEAD only  
**Response `204`**

---

### `GET /events/:id/attendees`
Lấy danh sách người tham dự của một sự kiện.  
**Auth:** LEAD, ADVISOR, HR_EVENT DEPARTMENT_LEAD/MEMBER

**Response `200`:**
```json
{
  "data": {
    "eventId": "uuid",
    "totalRegistered": 45,
    "totalCheckedIn": 38,
    "attendanceRate": 84,
    "attendees": [
      {
        "id": "uuid",
        "userId": "uuid",
        "fullName": "Nguyễn Thành Nam",
        "mssv": "SE200707",
        "email": "namntse200707@fpt.edu.vn",
        "departmentName": "Ban AI",
        "checkedIn": true,
        "checkinTime": "2026-09-20T01:15:00Z",
        "checkinMethod": "MANUAL_EVIDENCE",
        "isVerified": true
      }
    ]
  }
}
```

---

### `POST /events/:id/attendees`
Thêm người tham dự vào sự kiện (check-in tay tại bàn).  
**Auth:** LEAD, HR_EVENT DEPARTMENT_LEAD/MEMBER

**Request Body:**
```json
{
  "userId": "uuid",                  // Nếu là member CLB
  "guestName": "Nguyễn Văn X",       // Nếu là khách ngoài
  "guestMssv": "SE180123",
  "guestEmail": "xnvse180123@fpt.edu.vn",
  "guestDepartment": "Ban AI",
  "checkinMethod": "MANUAL_EVIDENCE",
  "isVerified": true
}
```

**Response `201`:** `{ "data": <EventAttendance> }`

---

### `PATCH /events/:id/attendees/:attendeeId/checkin`
Toggle trạng thái check-in của người tham dự.  
**Auth:** LEAD, HR_EVENT DEPARTMENT_LEAD/MEMBER  
⚠️ **Các role khác (BAN_LEAD, BAN_MEMBER, ADVISOR) bị từ chối — 403 Forbidden**

**Request Body:**
```json
{ "checkedIn": true }
```

**Response `200`:** `{ "data": <EventAttendance> }`

---

### `DELETE /events/:id/attendees/:attendeeId`
Xóa người tham dự khỏi sự kiện.  
**Auth:** LEAD, HR_EVENT DEPARTMENT_LEAD  
**Response `204`**

---

## 4. Tasks (Kanban Board)

### `GET /tasks`
Lấy danh sách tasks.  
**Auth:** Session cookie

**Query params:** `tenureId`, `departmentCode`, `status`, `assigneeId`, `page`, `limit`

**Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "Nghiên cứu Gemini 2.0 Multimodal API",
        "status": "IN_PROGRESS",
        "priority": "HIGH",
        "deadline": "2026-09-25T17:00:00Z",
        "gemsReward": 50,
        "department": { "code": "TECH_AI", "name": "Ban AI" },
        "assignees": [
          { "userId": "uuid", "fullName": "Trần Nguyên Bảo", "role": "PRIMARY" }
        ],
        "submissionUrl": null,
        "feedback": null
      }
    ],
    "total": 18,
    "page": 1
  }
}
```

---

### `POST /tasks`
Tạo task mới.  
**Auth:** LEAD, DEPARTMENT_LEAD

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "priority": "HIGH",
  "deadline": "2026-09-25T17:00:00Z",
  "gemsReward": 50,
  "departmentCode": "TECH_AI",
  "tenureId": "uuid",
  "assigneeIds": ["uuid1", "uuid2"],
  "eventId": "uuid | null"
}
```

**Response `201`:** `{ "data": <Task> }`

---

### `PUT /tasks/:id`
Cập nhật task (title, description, priority, deadline, gemsReward).  
**Auth:** LEAD, DEPARTMENT_LEAD (trong ban mình)  
**Response `200`:** `{ "data": <Task> }`

---

### `PATCH /tasks/:id/status`
Cập nhật status task (Kanban drag-and-drop).  
**Auth:** LEAD, DEPARTMENT_LEAD, MEMBER (chỉ được move task của mình)

**Request Body:**
```json
{
  "status": "IN_REVIEW",
  "submissionUrl": "https://github.com/pull/123"
}
```

**Response `200`:** `{ "data": <Task> }`  
> Khi status → DONE (do LEAD/DEPARTMENT_LEAD approve): tự động trigger cộng gems.

---

### `DELETE /tasks/:id`
**Auth:** LEAD only  
**Response `204`**

---

## 5. Inventory (Kho Vật Tư)

> **Quyền ghi:** LEAD và HR_EVENT DEPARTMENT_LEAD

### `GET /inventory`
**Auth:** LEAD, ADVISOR, HR_EVENT DEPARTMENT_LEAD/MEMBER  
**Response `200`:** `{ "data": { "items": [InventoryItem], "total": number } }`

---

### `POST /inventory`
**Auth:** LEAD, HR_EVENT DEPARTMENT_LEAD  
**Request Body:** `{ name, category, quantity, holderName, holderUserId?, notes }`  
**Response `201`:** `{ "data": <InventoryItem> }`

---

### `PUT /inventory/:id`
**Auth:** LEAD, HR_EVENT DEPARTMENT_LEAD  
**Response `200`:** `{ "data": <InventoryItem> }`

---

### `DELETE /inventory/:id`
**Auth:** LEAD only  
**Response `204`**

---

## 6. Notifications

### `GET /notifications`
Lấy thông báo của user hiện tại (dựa trên ban và role).  
**Auth:** Session cookie

**Response `200`:**
```json
{
  "data": {
    "unreadCount": 3,
    "items": [
      {
        "id": "uuid",
        "title": "Nhiệm vụ mới được giao",
        "message": "string",
        "type": "TASK",
        "priority": "IMPORTANT",
        "isRead": false,
        "createdAt": "2026-09-14T07:30:00Z",
        "link": "/app/tasks",
        "sender": { "fullName": "Trần Nguyên Bảo", "role": "AI Lead" }
      }
    ]
  }
}
```

---

### `POST /notifications`
Gửi thông báo mới.  
**Auth:** LEAD (broadcast), DEPARTMENT_LEAD (cho ban mình)

**Request Body:**
```json
{
  "title": "string",
  "message": "string",
  "type": "BROADCAST",
  "priority": "URGENT",
  "targetDepartmentCode": "all | TECH_AI | HR_EVENT | ...",
  "link": "/app/events"
}
```

**Response `201`:** `{ "data": <Notification> }`

---

### `PATCH /notifications/:id/read`
Đánh dấu đã đọc một thông báo.  
**Auth:** Session cookie  
**Response `200`**

---

### `PATCH /notifications/read-all`
Đánh dấu đã đọc tất cả thông báo.  
**Auth:** Session cookie  
**Response `200`**

---

### `DELETE /notifications/:id`
Xóa thông báo (chỉ người gửi hoặc LEAD).  
**Auth:** LEAD, hoặc sender  
**Response `204`**

---

## 7. Gems & Gamification

### `GET /gems/leaderboard`
Bảng xếp hạng gems.  
**Auth:** Session cookie

**Query params:** `tenureId`, `departmentCode`, `limit` (default: 20)

**Response `200`:**
```json
{
  "data": {
    "updatedAt": "2026-09-16T00:00:00Z",
    "isFrozen": false,
    "rankings": [
      {
        "rank": 1,
        "userId": "uuid",
        "fullName": "Trần Nguyên Bảo",
        "mssv": "SE180101",
        "avatarUrl": "string",
        "departmentName": "Ban AI",
        "gemsBalance": 2400,
        "delta": "+150 tuần này"
      }
    ]
  }
}
```

---

### `GET /gems/transactions`
Lịch sử giao dịch gems của user.  
**Auth:** Session cookie (tự xem), LEAD (xem của bất kỳ user)

**Query params:** `userId` (LEAD only), `page`, `limit`

**Response `200`:**
```json
{
  "data": {
    "balance": 2400,
    "transactions": [
      {
        "id": "uuid",
        "amount": 50,
        "type": "TASK_REWARD",
        "reason": "Hoàn thành task: Nghiên cứu Gemini 2.0",
        "createdAt": "2026-09-14T10:00:00Z"
      }
    ]
  }
}
```

---

### `POST /gems/adjust`
Điều chỉnh gems thủ công (khen thưởng / phạt).  
**Auth:** LEAD only

**Request Body:**
```json
{
  "userId": "uuid",
  "amount": 100,
  "reason": "Khen thưởng tổ chức sự kiện xuất sắc"
}
```

**Response `201`:** `{ "data": <GemsTransaction> }`

---

## 8. Gift Shop (Đổi Quà)

### `GET /gifts`
Danh mục quà tặng.  
**Auth:** Session cookie  
**Response `200`:** `{ "data": [GiftItem] }`

---

### `POST /gifts/redeem`
Yêu cầu đổi quà.  
**Auth:** Session cookie

**Request Body:**
```json
{ "giftItemId": "uuid" }
```

**Response `201`:** `{ "data": <GiftRedemption> }`  
> Backend validate `gemsBalance >= gemsPrice`, trừ gems ngay, set status = PENDING.

---

### `PATCH /gifts/redemptions/:id/status`
BCN duyệt hoặc từ chối yêu cầu đổi quà.  
**Auth:** LEAD only

**Request Body:**
```json
{ "status": "APPROVED | DELIVERED | REJECTED", "notes": "string" }
```

**Response `200`:** `{ "data": <GiftRedemption> }`

---

## 9. Generation / Tenure Config

### `GET /config/generation`
Lấy config kỳ hiện tại.  
**Auth:** Session cookie

**Response `200`:**
```json
{
  "data": {
    "currentTenure": {
      "id": "uuid",
      "name": "Fall 2026",
      "genLabel": "Gen 4.0",
      "startDate": "2026-09-01",
      "endDate": "2027-01-31",
      "isFrozen": false,
      "chapterLead": "Đặng Mai Phương"
    },
    "allowTaskSubmission": true,
    "allowRsvp": true,
    "freezeLeaderboard": false,
    "archivedTenures": [
      {
        "id": "uuid",
        "name": "Summer 2026",
        "genLabel": "Gen 3.0",
        "totalTasks": 86,
        "totalGems": 24500,
        "membersCount": 48,
        "eventsCount": 3,
        "archivedAt": "2026-08-31"
      }
    ]
  }
}
```

---

### `PUT /config/generation`
Cập nhật config kỳ hiện tại.  
**Auth:** LEAD only

**Request Body:**
```json
{
  "isFrozen": false,
  "allowTaskSubmission": true,
  "allowRsvp": true,
  "freezeLeaderboard": false,
  "chapterLead": "string",
  "coChapterLead": "string"
}
```

**Response `200`:** `{ "data": <TenureConfig> }`

---

### `POST /config/generation/transition`
Chuyển sang nhiệm kỳ mới (kết toán kỳ cũ + kích hoạt kỳ mới).  
**Auth:** LEAD only

**Request Body:**
```json
{
  "newTenureName": "Spring 2027",
  "newGenLabel": "Gen 4.5",
  "startDate": "2027-02-01",
  "endDate": "2027-06-30",
  "carryOverCoreTeam": true,
  "notifyAllMembers": true
}
```

**Response `200`:**
```json
{
  "data": {
    "archived": { "tenureId": "uuid", "snapshot": { "totalTasks": 52, "totalGems": 31000 } },
    "newTenure": { "id": "uuid", "name": "Spring 2027" }
  }
}
```

---

## 10. Landing CMS (Nội Dung Landing Page)

> **Ghi chú:** Landing page FE đọc data tĩnh từ `gdgData.ts`. Khi backend sẵn sàng, FE sẽ fetch thay thế.

### `GET /cms/events`
Events hiển thị trên landing page (isPublic = true).  
**Auth:** Không yêu cầu (public)  
**Response:** Xem `GET /events?isPublic=true`

---

### `GET /cms/stats`
Số liệu milestone hiển thị trên landing (Impact section).  
**Auth:** Không yêu cầu

**Response `200`:**
```json
{
  "data": [
    { "label": "Hoạt Động & Sự Kiện", "value": "10+", "accentColor": "#4285F4" },
    { "label": "Lượt Sinh Viên Tham Gia", "value": "100+", "accentColor": "#34A853" }
  ]
}
```

---

### `PUT /cms/stats`
BCN cập nhật số liệu milestone.  
**Auth:** LEAD  
**Request Body:** `[{ label, value, description, accentColor }]`  
**Response `200`:** `{ "data": <Stats[]> }`

---

## 11. Drive Assets (Tài Nguyên Google Drive)

### `GET /assets`
Lấy danh sách tài nguyên.  
**Auth:** Session cookie (filter theo accessLevel dựa trên role)

**Query params:** `category`, `departmentCode`, `eventId`, `accessLevel`

**Response `200`:** `{ "data": { "items": [DriveAsset], "total": number } }`

---

### `POST /assets`
Đăng ký tài nguyên mới.  
**Auth:** LEAD, DEPARTMENT_LEAD

**Request Body:**
```json
{
  "name": "Brand Kit Gen 4.0",
  "category": "BRAND_KIT",
  "driveUrl": "https://drive.google.com/...",
  "driveFileId": "1AbCd...",
  "accessLevel": "INTERNAL_MEMBER",
  "departmentCode": "MEDIA",
  "tenureId": "uuid"
}
```

**Response `201`:** `{ "data": <DriveAsset> }`

---

### `PUT /assets/:id` / `DELETE /assets/:id`
**Auth:** LEAD, owner DEPARTMENT_LEAD  
**Response `200` / `204`**

---

## Notes cho Backend Team

### 1. Permission Logic cho Điểm Danh
```
POST   /events/:id/attendees           → LEAD + HR_EVENT (DEPARTMENT_LEAD + MEMBER)
PATCH  /events/:id/attendees/:id/checkin → LEAD + HR_EVENT (DEPARTMENT_LEAD + MEMBER)
DELETE /events/:id/attendees/:id       → LEAD + HR_EVENT DEPARTMENT_LEAD
GET    /events/:id/attendees           → LEAD + ADVISOR + HR_EVENT (tất cả roles trong HR_EVENT)
```
> Tất cả role khác (TECH_AI, TECH_CLOUD, v.v.) chỉ được **xem** danh sách attendees nếu được cấp quyền riêng, không được toggle check-in.

### 2. Gems Idempotency
Khi cộng gems tự động (task done, event attendance), backend phải sử dụng `idempotencyKey` để tránh cộng 2 lần:
```
task_reward_{taskId}_{userId}
event_attendance_{eventId}_{userId}
event_organizer_{eventId}_{userId}
```

### 3. Discord Integration (Optional Phase 2)
- Mỗi Department có `discordRoleId` → sync role khi member được thêm/xóa
- `EventAttendance` với `checkinMethod = DISCORD_COMMAND` → bot Discord call `POST /events/:id/attendees`
- Notification broadcast → bot post vào channel Discord tương ứng

### 4. Pagination mặc định
- Default: `page=1`, `limit=20` (members: 50)
- Max limit: `100`

### 5. Soft Delete
- Member không được xóa cứng → set `status = ALUMNI` trong `UserTenure`
- Event/Task không được xóa cứng → set `deletedAt` (soft delete pattern)
