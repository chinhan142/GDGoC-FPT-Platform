# 📋 Implementation Plan — Sprint 10: Frontend-Backend Full Alignment & Contract Harmonization

**Dự án:** GDGoC FPTU HCMC Portal  
**Phân hệ:** Frontend Module Alignment (React + Vite + Zustand ➔ NestJS + Prisma)  
**Mục tiêu:** Đồng bộ 100% dữ liệu, DTOs, Enums và luồng giao tiếp giữa Frontend với Backend chuẩn đã hoàn thiện. Giữ nguyên toàn bộ visual design, layout và Tailwind styling sẵn có của FE.

---

## 🔒 Cam Kết Bảo Mật (Security Compliance)
1. **Không hardcode biến môi trường**: Toàn bộ endpoint và config giao tiếp qua client axios / fetch với API proxy `/api`.
2. **Tuân thủ RBAC**: BCN (`ORG_ADMIN` / `LEAD`), Cố vấn (`ADVISOR`), Trưởng Ban (`BAN_LEAD` / `DEPARTMENT_LEAD`), Thành viên (`BAN_MEMBER` / `MEMBER`), CTV (`COLLABORATOR`).

---

## 🎯 Chi Tiết Hạng Mục Đồng Bộ

### 1. Phân hệ Nhân sự & Hồ sơ cá nhân (`HRManagement.tsx`, `MemberModal.tsx`, `ExcelImportModal.tsx`, `MyProfile.tsx`, `useMemberStore.ts`)
- **Tự động suy ra khóa sinh viên (Cohort/Academic Year)**: Tự động trích xuất từ 2 chữ số đầu của MSSV (vd: `SE180123` ➔ Khóa K18) thay vì yêu cầu người dùng chọn trường `academicYear` riêng biệt.
- **Tenure UUID Alignment**: Bổ sung `tenureId` từ danh sách `availableTenures` vào Member Modal và Excel Import Modal.
- **Đồng bộ Enums & Tiers**: Hỗ trợ đầy đủ 5 Tiers (`ORG_ADMIN`, `ADVISOR`, `BAN_LEAD`, `BAN_MEMBER`, `COLLABORATOR`) và 4 Member Statuses (`ACTIVE`, `PROBATION`, `ON_LEAVE`, `ALUMNI`).
- **Profile Sanitization**: Tự động chuyển đổi các link mạng xã hội chuỗi rỗng `""` thành `undefined` trước khi gọi `PUT /api/members/:id/profile`, tránh lỗi 400 Bad Request từ validator `@IsUrl()`.
- **Excel Import Headers**: Đồng bộ template tải về gồm 7 cột chuẩn: `['Họ và tên', 'MSSV', 'Email', 'Số điện thoại', 'Ban Chuyên Môn', 'Vai Trò', 'Position']`.

### 2. Phân hệ Bảng Vinh Danh Gems & Thống kê (`GemsLeaderboard.tsx`, `DashboardOverview.tsx`, `gems.api.ts`)
- **Phẳng hóa cấu trúc dữ liệu Leaderboard**: Backend trả về `rankings: [{ rank, userId, fullName, mssv, avatarUrl, departmentName, gemsBalance, delta }]`. Frontend map trực tiếp các trường phẳng thay vì truy cập lồng `item.user.fullName` trong mảng `items`.

### 3. Phân hệ Quản Lý Sự Kiện & Điểm Danh (`EventAttendance.tsx`, `events.api.ts`)
- **Đồng bộ EventType**: `WORKSHOP`, `SHOWCASE`, `HACKATHON`, `FLAGSHIP`, `CAMPUS_CHALLENGE`, `MEETING`, `TEAMBUILDING`.
- **Check-in Method**: Cập nhật sang `MANUAL_EVIDENCE` (chuẩn Prisma enum `CheckinMethod`).
- **Data Mapping Attendees**: Hỗ trợ linh hoạt cả cấu trúc lồng `att.user` lẫn flat `att.fullName`, `att.mssv`, `att.email`, `att.departmentName`.
- **Event Card Metrics**: Hiển thị số lượng đăng ký và số lượng đã check-in từ `attendeeCount` & `checkedInCount`.

### 4. Phân hệ Kho Tài Nguyên Drive (`AssetHub.tsx`, `assets.api.ts`)
- **Cấp độ truy cập AccessLevel**: Cập nhật từ `CORE_LEAD_ONLY` sang `EXECUTIVE_ONLY` (khớp với Prisma enum `AccessLevel`).

---

## 🧪 Kế Hoạch Kiểm Thử (Verification Plan)
1. **TypeScript Typecheck**: Chạy `npx tsc --noEmit` đạt 0 lỗi.
2. **Production Build**: Chạy `npm run build` hoàn thành bundle thành công.
