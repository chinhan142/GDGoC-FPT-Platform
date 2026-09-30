# 🧐 GDGoC Platform — Hướng Dẫn Nghiệm Thu Code Sprint 04 (Review Guide)
**Dành cho:** Web Lead  
**Phân hệ:** Quản lý Công việc Kanban & Đồng bộ Workflow (Tasks Kanban & Workflow Sync)  
**Thời gian:** 23/09/2026  

---

## 🎯 1. Thứ Tự Rà Soát Code Logic (Bottom-Up Review Flow)

Vui lòng duyệt qua các tệp mã nguồn theo thứ tự từ dưới lên:

```
1. Data Transfer Objects (DTOs)
   ├── query-task.dto.ts
   ├── create-task.dto.ts
   ├── update-task.dto.ts
   ├── update-task-status.dto.ts
   ├── assign-task.dto.ts
   ├── submit-task.dto.ts
   ├── approve-task.dto.ts
   └── reject-task.dto.ts
   
2. Business Logic Layer
   └── tasks.service.ts
   
3. Controller & Routing Layer
   └── tasks.controller.ts
```

---

## 🔍 2. Checklist Các Điểm Kỹ Thuật & Nghiệp Vụ Cần Soi Kỹ

### 🛡️ A. Bảo mật & Phân quyền RBAC
- [x] **Phân quyền tạo và duyệt task**: `POST /tasks`, `PUT /tasks/:id`, `POST /approve`, `POST /reject`, `POST /assignees` được bảo vệ bởi `@Roles(Role.LEAD, Role.DEPARTMENT_LEAD)`.
- [x] **Bảo vệ di chuyển Kanban cho Member**: Trong `updateStatus`, nếu người gọi là `MEMBER`, chỉ cho phép sửa nếu họ là assignee và từ chối nếu họ cố tình tự chuyển sang `DONE` (403 Forbidden).
- [x] **Xóa task tối cao**: Chỉ duy nhất role `LEAD` mới có quyền `DELETE /api/tasks/:id`.
- [x] **Cơ chế Idempotency chống gian lận Gems**: `grantTaskGemsReward` kiểm tra tồn tại của `idempotencyKey = "task_reward_${task.id}_${assignee.userId}"` trước khi ghi nhận `GemsTransaction` và cập nhật `gemsBalance`.

### ⚡ B. Xử lý Trạng thái & Tự động hóa
- [x] **Tự động quét Overdue**: `findAll` tự động cập nhật các task quá hạn deadline sang `OVERDUE`.
- [x] **Tự động cấp Gems**: Khi chuyển trạng thái task sang `DONE` qua `updateStatus` hoặc `approveTask`, Gems được cấp tự động trong transaction ACID.
- [x] **Linh hoạt đầu vào DTO**: Chấp nhận cả `departmentCode` (ví dụ `TECH_AI`) lẫn `departmentId`, cả `assigneeIds` dạng string array lẫn `assignees` dạng object.

---

## 🧪 3. Kịch Bản Kiểm Thử Nhanh (Step-by-Step Test Scenarios)

### 🔹 Bước 1: Khởi động Server
```powershell
cd d:\GDG-Management\backend
npm run start:dev
```
Truy cập Swagger Docs tại: **`http://localhost:8080/api/docs`**

---

### 🔹 Bước 2: Test Tạo Task Mới (`POST /api/tasks`)
**Tài khoản:** Đăng nhập role `LEAD` hoặc `DEPARTMENT_LEAD`.  
**Payload mẫu:**
```json
{
  "title": "Nghiên cứu Gemini 2.0 Flash API",
  "description": "Viết tài liệu và benchmark tốc độ xử lý multimodal của Gemini 2.0",
  "priority": "HIGH",
  "deadline": "2026-10-30T17:00:00.000Z",
  "gemsReward": 50,
  "departmentCode": "TECH_AI",
  "tenureId": "<ID_TENURE_ACTIVE>",
  "assigneeIds": ["<MEMBER_USER_ID>"]
}
```
👉 **Kỳ vọng:** Trả về HTTP 201 kèm thông tin Task và quan hệ `assignees`.

---

### 🔹 Bước 3: Test Truy Vấn & Bộ Lọc (`GET /api/tasks`)
Thử các truy vấn:
1. `GET /api/tasks` (Lấy toàn bộ task)
2. `GET /api/tasks?departmentCode=TECH_AI&status=TODO` (Lọc theo ban và trạng thái)
3. `GET /api/tasks?search=Gemini` (Tìm kiếm theo từ khóa)
👉 **Kỳ vọng:** Trả về danh sách task kèm metadata phân trang `{ items, total, page, limit, totalPages }`.

---

### 🔹 Bước 4: Test Nộp Bài Nghiệm Thu (`POST /api/tasks/:id/submit`)
**Tài khoản:** Member được phân công task.  
**Payload mẫu:**
```json
{
  "submissionUrl": "https://github.com/gdgoc-fptu/gemini-research/pull/1"
}
```
👉 **Kỳ vọng:** Trả về HTTP 201/200, Task chuyển sang `status: "IN_REVIEW"` và lưu `submissionUrl`.

---

### 🔹 Bước 5: Test Phê Duyệt & Tự Động Cấp Gems (`POST /api/tasks/:id/approve`)
**Tài khoản:** `LEAD` hoặc `DEPARTMENT_LEAD`.  
**Payload mẫu:**
```json
{
  "feedback": "Bài nghiên cứu rất chất lượng, code clean và benchmark chi tiết!"
}
```
👉 **Kỳ vọng:**
1. Task chuyển sang `status: "DONE"` và lưu `feedback`.
2. Kiểm tra database: Bảng `gems_transactions` có bản ghi mới với `amount: 50`, `type: "TASK_REWARD"`, `idempotencyKey: "task_reward_<taskId>_<userId>"`.
3. Số dư `gemsBalance` của member tăng thêm 50 Gems.
4. Thử bấm approve lần 2: Đảm bảo không bị cộng dồn thêm Gems.

---

### 🔹 Bước 6: Test Từ Chối / Yêu Cầu Sửa Lại (`POST /api/tasks/:id/reject`)
**Payload mẫu:**
```json
{
  "feedback": "Vui lòng bổ sung thêm phần so sánh latency giữa Gemini Flash và Pro"
}
```
👉 **Kỳ vọng:** Task chuyển về `status: "IN_PROGRESS"` kèm `feedback` để member sửa lại.
