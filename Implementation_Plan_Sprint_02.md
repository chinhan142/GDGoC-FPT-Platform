# Kế hoạch Thực hiện Sprint 02 (Implementation Plan)
**Phân hệ:** Module HR & Quản lý Thành viên (Members & HR Management)  
**Thời gian thực hiện:** 21/09/2026 (Block 50 phút)  
**Người phụ trách:** Web Lead + AI Co-Pilot  

---

## 1. Mục tiêu & Bối cảnh (Objectives & Context)

Xây dựng toàn diện phân hệ **HR & Quản lý Thành viên (`MembersModule`)** cho GDGoC Portal nhằm phục vụ các màn hình quản trị nhân sự `/app/hr`, trang hồ sơ cá nhân `/app/profile`, và danh sách Ban Điều Hành (Organizers) công khai cho Landing Page (`/`).

### 🎯 Các Mục Tiêu Nghiệp Vụ Trọng Tâm:
1. **Quản lý danh sách thành viên (`GET /api/members`)**:
   - Hỗ trợ lọc theo `tenureId` (mặc định là tenure đang active), `departmentCode`, trạng thái `status` (`ACTIVE`, `PROBATION`, `ON_LEAVE`, `ALUMNI`), tìm kiếm `search` (MSSV, tên, email) và phân trang chuẩn (`page`, `limit`).
   - Phân quyền RBAC nghiêm ngặt: `LEAD` và `ADVISOR` có quyền xem toàn bộ CLB; `DEPARTMENT_LEAD` chỉ được xem thành viên thuộc ban của mình.
2. **Thêm mới thành viên (`POST /api/members`)**:
   - Dành riêng cho `LEAD`. Tự động tạo tài khoản `User` (mật khẩu ngẫu nhiên hoặc mặc định được hash bcrypt) nếu chưa có, và gắn vào `UserTenure` của nhiệm kỳ được chỉ định.
3. **Cập nhật thông tin thành viên từ BCN (`PUT /api/members/:id`)**:
   - Dành cho `LEAD` để điều chỉnh chức danh (`position`), ban (`departmentCode`), vai trò (`role`) và trạng thái hoạt động (`status`).
4. **Xóa mềm thành viên (`DELETE /api/members/:id`)**:
   - Dành cho `LEAD`. Chuyển trạng thái `UserTenure.status` sang `ALUMNI` (Soft Delete), bảo toàn toàn bộ lịch sử đóng góp và điểm danh.
5. **Nhập danh sách hàng loạt qua Excel/CSV (`POST /api/members/import`)**:
   - Dành cho `LEAD`. Hỗ trợ upload file `.xlsx` hoặc `.csv` (sử dụng thư viện `xlsx` / `exceljs`), bóc tách dữ liệu MSSV, Họ tên, Email, SĐT, tự động gán vào Ban và Nhiệm kỳ tương ứng, trả về thống kê số lượng `added`, `skipped`, và danh sách `errors` chi tiết theo từng dòng.
6. **Thành viên tự cập nhật thông tin (`PUT /api/members/:id/profile`)**:
   - Cho phép bất kỳ thành viên nào tự chỉnh sửa bio, kỹ năng (`skills`), avatar, liên kết mạng xã hội (GitHub, LinkedIn, Facebook, Discord). Kiểm tra quyền sở hữu ID (`current_user.id === target_id` hoặc role `LEAD`).
7. **Danh sách Organizers công khai (`GET /api/members/organizers`)**:
   - Endpoint Public (không cần đăng nhập) trả về danh sách Ban Điều Hành / Thành viên tiêu biểu hiển thị trên Landing Page, hỗ trợ query `featured=true`.

---

## 2. Tiêu chuẩn Bảo mật & Môi trường (Security & Compliance Mandates)

- 🔒 **Không hardcode biến môi trường**: Tất cả cấu hình được inject qua `ConfigService` hoặc đọc từ `process.env`.
- 🛡️ **Bảo vệ dữ liệu nhạy cảm**: Tuyệt đối không trả về `passwordHash` trong bất kỳ response DTO nào.
- 🍪 **Xác thực Cookie an toàn**: Mọi endpoint quản trị đều được bảo vệ bởi `JwtAuthGuard` (HttpOnly Cookie `session_token`) và `RolesGuard`.
- ⚡ **Kiểm soát phân quyền RBAC**:
  - `GET /api/members`: `LEAD`, `ADVISOR`, `DEPARTMENT_LEAD`
  - `POST /api/members`, `PUT /api/members/:id`, `DELETE /api/members/:id`, `POST /api/members/import`: Chỉ `LEAD`
  - `PUT /api/members/:id/profile`: Owner hoặc `LEAD`
  - `GET /api/members/organizers`: Public (`@Public()` decorator)
- 📁 **File Upload Security**: Kiểm tra MIME-type và dung lượng tối đa của file Excel (giới hạn 5MB) để phòng chống DoS.

---

## 3. Kiến trúc Kỹ thuật & Chi tiết Triển khai (Technical Design)

### 3.1. Cấu trúc Module (`MembersModule` / `UsersModule`)
```
backend/src/modules/members/
├── dto/
│   ├── query-members.dto.ts       # Query params cho GET /members
│   ├── create-member.dto.ts       # DTO thêm thành viên mới
│   ├── update-member.dto.ts       # DTO BCN cập nhật thành viên
│   ├── update-profile.dto.ts      # DTO thành viên tự sửa profile
│   └── import-members.dto.ts      # DTO multipart cho import excel
├── members.controller.ts          # Định nghĩa 7 API endpoints
├── members.service.ts             # Business logic, Excel parser, RBAC filtering
├── members.module.ts              # Wire up PrismaModule, MulterModule
└── excel-parser.util.ts           # Utility bóc tách .xlsx / .csv
```

### 3.2. Đặc tả Chi tiết các DTO & API Endpoints

#### 1. `GET /api/members`
- **Query DTO (`QueryMembersDto`)**:
  - `tenureId?: string` (UUID)
  - `departmentCode?: DepartmentType`
  - `status?: MemberStatus`
  - `search?: string`
  - `page?: number = 1`
  - `limit?: number = 50`
- **Logic Service**:
  - Nếu không truyền `tenureId`, tự động tìm `Tenure` active gần nhất (`isFrozen: false`).
  - Nếu `user.role === 'DEPARTMENT_LEAD'`, ép điều kiện lọc chỉ lấy `departmentId` thuộc ban của Lead đó.
  - Sử dụng Prisma `findMany` kết hợp `count` để phân trang và format response theo đúng Contract.

#### 2. `POST /api/members`
- **Body DTO (`CreateMemberDto`)**:
  - `mssv: string` (Pattern SE/SS/IA/...)
  - `fullName: string`
  - `email: string` (Email FPT format)
  - `phoneNumber?: string`
  - `departmentCode: DepartmentType`
  - `role?: Role` (default `MEMBER`)
  - `position?: string`
  - `tenureId: string`
  - `joinedAt?: string`
- **Logic Service**:
  - Tìm `Department` theo `code`.
  - Tìm hoặc tạo `User` (upsert theo `email` hoặc `mssv`), tạo mật khẩu mặc định (hash bcrypt).
  - Tạo bản ghi `UserTenure`. Nếu đã tồn tại trong kỳ đó, trả về `409 Conflict`.

#### 3. `PUT /api/members/:id`
- **Param**: `id` (`userTenureId` hoặc `userId`)
- **Body DTO (`UpdateMemberDto`)**:
  - `role?: Role`
  - `status?: MemberStatus`
  - `position?: string`
  - `departmentCode?: DepartmentType`
- **Logic Service**: Cập nhật `UserTenure` và cập nhật quan hệ Department tương ứng.

#### 4. `DELETE /api/members/:id`
- **Param**: `id`
- **Logic Service**: Cập nhật `status = 'ALUMNI'` trên `UserTenure`, trả về HTTP 204 No Content.

#### 5. `POST /api/members/import`
- **Interceptor**: `FileInterceptor('file')`
- **Body Fields**: `tenureId: string`, `defaultRole?: Role`, `departmentCode?: DepartmentType`
- **Logic Service**:
  - Đọc file buffer qua `xlsx` (SheetJS).
  - Lặp qua các dòng: kiểm tra hợp lệ MSSV, Email, Họ tên.
  - Xử lý từng dòng: bỏ qua trùng lặp hoặc báo lỗi, tạo mới bản ghi hợp lệ.
  - Trả về `{ added: count, skipped: count, errors: string[] }`.

#### 6. `PUT /api/members/:id/profile`
- **Guard/Check**: `req.user.id === id || req.user.role === 'LEAD'`
- **Body DTO (`UpdateProfileDto`)**:
  - `bio?: string`
  - `phoneNumber?: string`
  - `avatarUrl?: string`
  - `skills?: string[]`
  - `githubUrl?: string`
  - `linkedinUrl?: string`
  - `facebookUrl?: string`
  - `discordUsername?: string`
- **Logic Service**: Cập nhật thông tin trên cả bảng `User` và bảng `UserTenure` hiện tại.

#### 7. `GET /api/members/organizers`
- **Decorator**: `@Public()`
- **Query DTO**: `featured?: boolean`
- **Logic Service**: Lấy danh sách thành viên có vai trò `LEAD`, `DEPARTMENT_LEAD` hoặc thuộc ban `EXECUTIVE` trong nhiệm kỳ hiện tại, định dạng dữ liệu cho Landing Page.

---

## 4. Kế hoạch Kiểm thử & Nghiệm thu (Verification Plan)

### 4.1. Automated / Build Testing
- Cài đặt thư viện xử lý file: `xlsx` (SheetJS) và `@types/multer`.
- Chạy `npm run build` để đảm bảo code TypeScript chặt chẽ, không lỗi type.

### 4.2. Endpoint Verification Checklist
1. `GET /api/members` với các bộ lọc (`search`, `status`, `departmentCode`) và kiểm tra phân quyền `DEPARTMENT_LEAD` chỉ thấy ban mình.
2. `POST /api/members` tạo thành viên mới thành công và hash password an toàn.
3. `PUT /api/members/:id` cập nhật role/ban/status.
4. `DELETE /api/members/:id` chuyển status sang `ALUMNI` (HTTP 204).
5. `POST /api/members/import` test upload file Excel mẫu chứa dòng đúng + dòng sai format, kiểm tra báo cáo lỗi chi tiết.
6. `PUT /api/members/:id/profile` test member tự sửa thông tin và test case sửa tài khoản người khác bị chặn (403).
7. `GET /api/members/organizers` truy cập không cần token/cookie, trả về đúng danh sách BCN cho Landing Page.
8. Kiểm tra Swagger UI tại `http://localhost:8080/api/docs` hiển thị đầy đủ schema và DTOs.
