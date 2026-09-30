# 🧐 GDGoC Platform — Hướng Dẫn Nghiệm Thu Code Sprint 02 (Review Guide)
**Dành cho:** Web Lead  
**Phân hệ:** Module HR & Quản lý Thành viên (Members & HR Management)  
**Thời gian:** 23/09/2026  

---

## 🎯 1. Thứ Tự Rà Soát Code Logic (Bottom-Up Review Flow)

Vui lòng duyệt qua các tệp mã nguồn theo thứ tự từ dưới lên:

```
1. Utilities & DTOs
   ├── excel-parser.util.ts
   ├── query-members.dto.ts
   ├── create-member.dto.ts
   ├── update-member.dto.ts
   ├── update-profile.dto.ts
   └── import-members.dto.ts
   
2. Business Logic Layer
   └── members.service.ts
   
3. Controller & RBAC Layer
   └── members.controller.ts
   
4. Module Integration
   ├── members.module.ts
   └── app.module.ts
```

---

## 🔍 2. Checklist Các Điểm Kỹ Thuật & Nghiệp Vụ Cần Soi Kỹ

### 🛡️ A. Bảo mật & RBAC
- [x] **Không bao giờ lộ `passwordHash`**: Response của tất cả các endpoints tuyệt đối không chứa trường `passwordHash`.
- [x] **Quyền xem của `DEPARTMENT_LEAD`**: Trong `MembersService.getMembers()`, khi user có role `DEPARTMENT_LEAD`, query bắt buộc bị giới hạn `departmentId = user.departmentId`.
- [x] **Quyền cập nhật hồ sơ (`updateProfile`)**: Chỉ cho phép `currentUser.id === targetUserId` hoặc role `LEAD`.
- [x] **Soft Delete**: `deleteMember` chỉ chuyển `UserTenure.status` thành `ALUMNI`, không dùng lệnh `delete` vật lý nhằm bảo toàn dữ liệu liên kết.

### ⚡ B. Xử lý Dữ liệu & Excel Parser
- [x] **Bóc tách linh hoạt**: `parseMembersExcel` tự động nhận diện cả tiếng Việt và tiếng Anh cho các cột tiêu đề.
- [x] **Khử trùng lặp**: Kiểm tra `userId_tenureId` để không bị trùng lặp thành viên trong cùng một nhiệm kỳ.
- [x] **Mật khẩu khởi tạo an toàn**: `GDGoC@${mssv}` được hash qua `bcrypt.hash(..., 10)`.

---

## 🧪 3. Kịch Bản Kiểm Thử Nhanh (Step-by-Step Test Scenarios)

### 🔹 Bước 1: Khởi động Server
```powershell
cd d:\GDG-Management\backend
npm run start:dev
```
Truy cập Swagger Docs tại: **`http://localhost:8080/api/docs`**

---

### 🔹 Bước 2: Test Endpoint Public Organizers (Không cần đăng nhập)
```bash
curl -X GET "http://localhost:8080/api/members/organizers"
```
👉 **Kỳ vọng:** Trả về HTTP 200 kèm mảng các thành viên BCN/Lead hiển thị cho Landing Page.

---

### 🔹 Bước 3: Đăng nhập với tài khoản LEAD
Gọi `POST /api/auth/login` với email Lead FPT để trình duyệt/Postman nhận cookie `session_token`.

---

### 🔹 Bước 4: Test Thêm Thành Viên Mới (`POST /api/members`)
**Payload mẫu:**
```json
{
  "mssv": "SE189999",
  "fullName": "Nguyễn Văn Test",
  "email": "testse189999@fpt.edu.vn",
  "phoneNumber": "0988776655",
  "departmentCode": "TECH_WEB",
  "role": "MEMBER",
  "position": "Web Frontend Developer",
  "tenureId": "<ID_TENURE_ACTIVE>"
}
```
👉 **Kỳ vọng:** Trả về HTTP 201 kèm thông tin thành viên (không có `passwordHash`).

---

### 🔹 Bước 5: Test Lọc & Phân Trang Thành Viên (`GET /api/members`)
Thử các trường hợp:
1. `GET /api/members?departmentCode=TECH_WEB`
2. `GET /api/members?search=SE189999`
3. `GET /api/members?page=1&limit=10`
👉 **Kỳ vọng:** Dữ liệu trả về đúng cấu trúc `{ items: [...], total: n, page: 1, totalPages: 1 }`.

---

### 🔹 Bước 6: Test Thành Viên Tự Sửa Profile (`PUT /api/members/:id/profile`)
**Payload mẫu:**
```json
{
  "bio": "Fullstack Developer đam mê NestJS & Next.js",
  "skills": ["TypeScript", "NestJS", "React", "Docker"],
  "githubUrl": "https://github.com/gdgoc-fptu",
  "discordUsername": "tester#1234"
}
```
👉 **Kỳ vọng:** Trả về HTTP 200 với bio và skills đã được cập nhật.

---

### 🔹 Bước 7: Test Xóa Mềm (`DELETE /api/members/:id`)
Gọi `DELETE /api/members/<MEMBER_ID>`.
👉 **Kỳ vọng:** Trả về HTTP 204 No Content. Khi kiểm tra lại bằng `GET /api/members?status=ALUMNI` sẽ thấy thành viên này ở trạng thái `ALUMNI`.

---

### 🔹 Bước 8: Test Import Excel (`POST /api/members/import`)
Tạo một file `.xlsx` với các cột: `MSSV`, `Họ và tên`, `Email`, `Ban`, `Vai trò` và upload qua form-data.
👉 **Kỳ vọng:** Trả về `{ "added": number, "skipped": number, "errors": [] }`.
