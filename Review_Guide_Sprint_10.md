# 🧐 Code Review & Testing Guide — Sprint 10: Frontend-Backend Full Alignment

**Dành cho:** Web Lead / Tech Reviewer  
**Phân hệ:** Frontend Module Alignment (React + Vite + Zustand ➔ NestJS + Prisma)  

---

## 🔍 1. Trật Tự Rà Soát Code (Review Order)

```
Types / Enums (auth.types.ts, types.ts)
   ↓
API Modules (assets.api.ts, events.api.ts, cms.api.ts)
   ↓
Zustand Stores (useMemberStore.ts, useLandingContentStore.ts)
   ↓
Modal Components (MemberModal.tsx, ExcelImportModal.tsx)
   ↓
Internal Pages (HRManagement.tsx, EventAttendance.tsx, AssetHub.tsx, GemsLeaderboard.tsx)
```

---

## 📋 2. Các Điểm Kỹ Thuật & Nghiệp Vụ Cần Soi Kỹ (Key Focus Areas)

### 👤 A. Quản lý Nhân sự & Hồ sơ (HR & Profile)
1. **Kiểm tra trích xuất Khóa K tự động**:
   - Nhập MSSV `SE181234` ➔ Badge khóa tự động hiển thị `Khóa K18`.
   - Nhập MSSV `IA190055` ➔ Badge khóa tự động hiển thị `Khóa K19`.
   - Form gửi lên Backend chỉ bao gồm `mssv`, không gửi field thừa `academicYear`.
2. **Kiểm tra cập nhật Profile**:
   - Thử để trống các trường mạng xã hội (Github, LinkedIn, Facebook) rồi nhấn "Lưu Thay Đổi".
   - Kiểm tra request payload: các trường để trống phải là `undefined` (hoặc không gửi lên) thay vì chuỗi rỗng `""`. Backend sẽ không trả về lỗi `400 Bad Request: must be a URL address`.
3. **Kiểm tra Template Excel Import**:
   - Nhấn "Tải File Mẫu (.xlsx)" trong modal Import Excel.
   - Mở file và kiểm tra đủ 7 cột: `Họ và tên`, `MSSV`, `Email`, `Số điện thoại`, `Ban Chuyên Môn`, `Vai Trò`, `Position`.

### 💎 B. Bảng Vinh Danh Gems (Gems Leaderboard)
1. **Kiểm tra render dữ liệu Leaderboard**:
   - Truy cập màn hình Bảng xếp hạng Gems (`/app/leaderboard`) và Thẻ Top Leaderboard trên Dashboard (`/app/dashboard`).
   - Dữ liệu hiển thị đúng tên thành viên, MSSV, ban chuyên môn và số lượng Gems từ trường phẳng `rankings` do Backend trả về.

### 📅 C. Quản lý Sự Kiện & Điểm Danh (Event Operations)
1. **Kiểm tra tạo / sửa sự kiện**:
   - Mở modal tạo sự kiện, kiểm tra dropdown "Loại sự kiện" có đầy đủ 7 loại chuẩn (`WORKSHOP`, `SHOWCASE`, `HACKATHON`, `FLAGSHIP`, `CAMPUS_CHALLENGE`, `MEETING`, `TEAMBUILDING`).
2. **Kiểm tra điểm danh tại bàn**:
   - Thêm người tham dự thủ công tại bàn: trường `checkinMethod` gửi lên là `MANUAL_EVIDENCE`.

### 📂 D. Kho Tài Nguyên Google Drive (Asset Hub)
1. **Kiểm tra Cấp độ truy cập**:
   - Mở modal thêm tài nguyên Drive mới: dropdown "Cấp độ truy cập" chứa option `EXECUTIVE_ONLY` (Chỉ Ban Chủ Nhiệm) thay vì `CORE_LEAD_ONLY`.

---

## ⚡ 3. Lệnh Kiểm Tra Nhanh (Fast Verification)

Chạy trong thư mục `d:\GDG-Management-FE`:
```bash
# 1. Kiểm tra Typecheck toàn bộ dự án:
npx tsc --noEmit

# 2. Kiểm tra đóng gói Production:
npm run build
```
Cả 2 lệnh đều trả về Exit Code `0` (Success).
