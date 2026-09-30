# Kế hoạch Thực hiện Sprint 04 (Implementation Plan)
**Phân hệ:** Quản lý Công việc Kanban & Đồng bộ Workflow (Tasks Kanban & Workflow Sync)  
**Thời gian thực hiện:** 23/09/2026 (Block 50 phút)  
**Người phụ trách:** Web Lead + AI Co-Pilot  

---

## 1. Mục tiêu & Bối cảnh (Objectives & Context)

Xây dựng toàn diện phân hệ **Quản lý Công việc Kanban (`TasksModule`)** cho GDGoC Portal, kết nối trực tiếp với giao diện kéo thả Kanban của Frontend, tích hợp luồng nộp bài nghiệm thu, feedback và cơ chế tự động cấp thưởng Gems cho thành viên khi task hoàn thành.

### 🎯 Các Mục Tiêu Nghiệp Vụ Trọng Tâm:
1. **Đồng bộ Kanban 6 Trạng thái (`TaskStatus`)**:
   - `BACKLOG`: Ý tưởng, backlog cần tinh chỉnh trước khi đưa vào sprint.
   - `TODO`: Task đã sẵn sàng, chờ thành viên nhận và bắt đầu.
   - `IN_PROGRESS`: Task đang được triển khai.
   - `IN_REVIEW`: Thành viên đã nộp bài (`submissionUrl`), chờ Lead review.
   - `DONE`: Task đã được Lead phê duyệt nghiệm thu, tự động kích hoạt cấp Gems.
   - `OVERDUE`: Tự động nhận diện các task quá hạn deadline để đôn đốc.
2. **Quản lý Vòng đời & Gán Thành viên (`CRUD /api/tasks`)**:
   - `POST /api/tasks`: Cho phép `LEAD` và `DEPARTMENT_LEAD` tạo task mới, gán `assignees` (hỗ trợ cả danh sách `assigneeIds` hoặc `TaskAssigneeInput` với `role: PRIMARY | MEMBER`), gắn kèm sự kiện `eventId` và ban chuyên môn (`departmentCode` hoặc `departmentId`).
   - `PUT /api/tasks/:id`: Cập nhật thông tin task (tiêu đề, mô tả, deadline, gemsReward, priority, ban, assignees).
   - `DELETE /api/tasks/:id`: Quyền tối cao dành riêng cho `LEAD`.
3. **Kéo thả Trạng thái & Nộp bài Nghiệm thu (`PATCH /api/tasks/:id/status`, `POST /api/tasks/:id/submit`)**:
   - Hỗ trợ kéo thả trên Kanban: Khi thành viên move task sang `IN_REVIEW`, kèm link nghiệm thu `submissionUrl`.
   - Phân quyền cập nhật trạng thái: `LEAD`, `DEPARTMENT_LEAD` (quản lý toàn ban), `MEMBER` (chỉ được cập nhật trạng thái task mà mình là assignee).
4. **Phê duyệt, Đánh giá & Tự động Cấp Gems (`POST /api/tasks/:id/approve`, `POST /api/tasks/:id/reject`)**:
   - Lead review và gửi `feedback`.
   - Khi task được `approve` (hoặc chuyển sang `DONE`): Tự động tạo bản ghi `GemsTransaction` với `idempotencyKey = "task_reward_${taskId}_${userId}"` và tăng `gemsBalance` cho tất cả assignees của task trong một Prisma Database Transaction chuẩn ACID.
   - Khi task bị `reject`: Chuyển về `IN_PROGRESS` kèm `feedback` giải thích lý do cần sửa.
5. **Tự động quét Overdue & Tích hợp Discord Thread**:
   - Tự động đánh dấu `OVERDUE` cho các task chưa hoàn thành quá hạn `deadline`.
   - Hỗ trợ tạo Discord Thread thảo luận công việc theo ban khi tạo task mới.

---

## 2. Tiêu chuẩn Bảo mật & Môi trường (Security & Compliance Mandates)

- 🔒 **Không hardcode biến môi trường / Secrets**: Tất cả cấu hình Discord, JWT, DB đọc qua `ConfigService`.
- 🍪 **Xác thực Cookie an toàn**: Mọi request nội bộ bắt buộc đi qua `JwtAuthGuard` (Cookie `session_token`).
- ⚡ **Phân quyền RBAC chặt chẽ theo Ban & Vai trò**:
  - `LEAD`: Quản trị toàn bộ task của mọi ban.
  - `DEPARTMENT_LEAD`: Quản trị và tạo task trong ban mình phụ trách.
  - `MEMBER`: Chỉ có thể xem task, nhận task, nộp bài (`submit`) và chuyển trạng thái task của chính mình.
  - `ADVISOR`: Quyền xem (Read-only), không chỉnh sửa hay phê duyệt task.
- 🛡️ **Bảo vệ Giao dịch Gems (Idempotency Key)**: Đảm bảo 100% không bao giờ xảy ra tình trạng cấp Gems trùng lặp dù có nhiều request approve đồng thời.

---

## 3. Kiến trúc Kỹ thuật & Chi tiết Triển khai (Technical Design)

### 3.1. Cấu trúc Module (`TasksModule`)
```
backend/src/modules/tasks/
├── dto/
│   ├── query-task.dto.ts             # DTO lọc, tìm kiếm và phân trang
│   ├── create-task.dto.ts            # DTO tạo task mới (hỗ trợ departmentCode/Id & assignees)
│   ├── update-task.dto.ts            # DTO cập nhật thông tin task
│   ├── update-task-status.dto.ts     # DTO kéo thả cập nhật trạng thái Kanban
│   ├── assign-task.dto.ts            # DTO gán/phân bổ thành viên cho task
│   ├── submit-task.dto.ts            # DTO nộp link bài làm
│   ├── approve-task.dto.ts           # DTO duyệt task kèm feedback
│   └── reject-task.dto.ts            # DTO từ chối task kèm lý do
├── tasks.controller.ts               # REST API Controller theo chuẩn API Contract
├── tasks.service.ts                  # Service xử lý nghiệp vụ, ACID Gems & Discord
└── tasks.module.ts                   # Module kết nối Prisma, Auth & Discord
```

### 3.2. Đặc tả Chi tiết Endpoints

#### 1. `GET /api/tasks`
- **Auth:** `JwtAuthGuard`
- **Query DTO (`QueryTaskDto`)**:
  - `tenureId?: string`
  - `departmentCode?: DepartmentType`
  - `departmentId?: string`
  - `status?: TaskStatus`
  - `priority?: TaskPriority`
  - `assigneeId?: string`
  - `search?: string`
  - `page?: number = 1`
  - `limit?: number = 20`
- **Logic Service**:
  - Tự động cập nhật `OVERDUE` cho các task có `deadline < now` và `status in [TODO, IN_PROGRESS]`.
  - Hỗ trợ lọc theo cả `departmentCode` (enum) lẫn `departmentId` (UUID).
  - Trả về cấu trúc phân trang chuẩn: `{ items, total, page, limit, totalPages }`.

#### 2. `POST /api/tasks`
- **Auth:** `JwtAuthGuard`, `RolesGuard` (`LEAD`, `DEPARTMENT_LEAD`)
- **Body DTO (`CreateTaskDto`)**:
  - `title: string` (bắt buộc)
  - `description?: string`
  - `priority?: TaskPriority` (mặc định `MEDIUM`)
  - `deadline: string` (ISO 8601 Date string)
  - `gemsReward?: number` (mặc định 20)
  - `departmentCode?: DepartmentType` HOẶC `departmentId?: string`
  - `tenureId: string`
  - `assignees?: TaskAssigneeInput[]` HOẶC `assigneeIds?: string[]`
  - `eventId?: string`
- **Logic Service**:
  - Tự resolve `departmentId` nếu người dùng truyền `departmentCode`.
  - Validate phân quyền: `DEPARTMENT_LEAD` chỉ được tạo task cho chính ban của mình.
  - Tạo task và assignees trong transaction.
  - Tạo Discord Thread thông báo (async không chặn luồng).

#### 3. `PUT /api/tasks/:id`
- **Auth:** `JwtAuthGuard`, `RolesGuard` (`LEAD`, `DEPARTMENT_LEAD`)
- **Logic Service**:
  - Cập nhật thông tin task, đồng bộ lại danh sách assignees nếu có thay đổi.
  - `DEPARTMENT_LEAD` chỉ được chỉnh sửa task thuộc ban của mình.

#### 4. `PATCH /api/tasks/:id/status`
- **Auth:** `JwtAuthGuard`
- **Body DTO (`UpdateTaskStatusDto`)**:
  - `status: TaskStatus`
  - `submissionUrl?: string`
  - `feedback?: string`
- **Logic Service**:
  - Phân quyền: `MEMBER` chỉ được di chuyển task nếu là assignee của task đó.
  - Nếu `status === 'DONE'`: Kiểm tra quyền (chỉ `LEAD` / `DEPARTMENT_LEAD`) và tự động trigger cấp Gems.
  - Nếu có `submissionUrl`: Cập nhật link nộp bài.

#### 5. `POST /api/tasks/:id/submit`
- **Auth:** `JwtAuthGuard` (Assignee, `LEAD`, `DEPARTMENT_LEAD`)
- **Body DTO (`SubmitTaskDto`)**: `{ "submissionUrl": string }`
- **Logic Service**: Cập nhật `submissionUrl` và tự động chuyển `status` sang `IN_REVIEW`.

#### 6. `POST /api/tasks/:id/approve`
- **Auth:** `JwtAuthGuard`, `RolesGuard` (`LEAD`, `DEPARTMENT_LEAD`)
- **Body DTO (`ApproveTaskDto`)**: `{ "feedback"?: string }`
- **Logic Service**:
  - Chuyển `status` sang `DONE`.
  - Ghi nhận `feedback` nếu có.
  - Thực hiện cấp Gems ACID an toàn: Tạo `GemsTransaction` và tăng `user.gemsBalance` với `idempotencyKey`.

#### 7. `POST /api/tasks/:id/reject`
- **Auth:** `JwtAuthGuard`, `RolesGuard` (`LEAD`, `DEPARTMENT_LEAD`)
- **Body DTO (`RejectTaskDto`)**: `{ "feedback": string }`
- **Logic Service**: Chuyển `status` về `IN_PROGRESS` và lưu `feedback` để thành viên chỉnh sửa.

#### 8. `DELETE /api/tasks/:id`
- **Auth:** `JwtAuthGuard`, `RolesGuard` (`LEAD`)
- **Logic Service**: Xóa task và cascade xóa quan hệ assignees.

---

## 4. Kế hoạch Kiểm thử & Nghiệm thu (Verification Plan)

### 4.1. Automated Build & Type Checking
- Chạy `npm run build` trong thư mục `backend` để kiểm tra toàn bộ kiểu dữ liệu TypeScript, decorators và Prisma models.

### 4.2. API Contract & Functional Verification
1. Tạo Task với ban `TECH_WEB` và gán 2 thành viên.
2. Di chuyển trạng thái từ `TODO` -> `IN_PROGRESS` -> `IN_REVIEW` (nộp link bài làm GitHub/Drive).
3. Phê duyệt Task (`approve`) -> Kiểm tra `gemsBalance` của các assignees được cộng chính xác và có record trong bảng `gems_transactions`.
4. Thử phê duyệt lại lần 2 -> Đảm bảo `idempotencyKey` ngăn chặn việc cộng trùng lặp Gems.
5. Kiểm tra phân quyền: `MEMBER` không thể tự duyệt `DONE` task của chính mình (chỉ Lead mới có quyền approve).
