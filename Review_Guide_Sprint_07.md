# 🧐 GDGoC Platform — Hướng Dẫn Nghiệm Thu Code Sprint 07 (Review Guide)
**Dành cho:** Web Lead  
**Phân hệ:** Cấu Hình Niên Khóa, Quản Trị Drive Assets & Landing CMS (Generation Config, Drive & CMS)  
**Thời gian:** 23/09/2026  

---

## 🎯 1. Thứ Tự Rà Soát Code Logic (Bottom-Up Review Flow)

Vui lòng duyệt qua các tệp mã nguồn theo thứ tự từ dưới lên:

```
1. Tenures & Generation Config
   ├── dto/
   │   ├── update-tenure-config.dto.ts
   │   └── transition-tenure.dto.ts
   ├── tenures.service.ts
   ├── tenures.controller.ts
   └── tenures.module.ts

2. Drive Assets Hub
   ├── dto/
   │   ├── create-asset.dto.ts
   │   ├── update-asset.dto.ts
   │   └── query-assets.dto.ts
   ├── drive.service.ts
   ├── drive.controller.ts
   └── drive.module.ts

3. Landing CMS Module
   ├── dto/
   │   └── update-stats.dto.ts
   ├── cms.service.ts
   ├── cms.controller.ts
   └── cms.module.ts
```

---

## 🔍 2. Checklist Các Điểm Kỹ Thuật & Nghiệp Vụ Cần Soi Kỹ

### 🛡️ A. Bảo mật & Tính Toàn Vẹn Chuyển Giao Kỳ
- [x] **Toàn vẹn Transaction khi Transition (`transition`)**: Archive kỳ cũ, tính snapshot, tạo kỳ mới, sao chép Core Team và gửi thông báo broadcast đều chạy trong một `prisma.$transaction`.
- [x] **Ma trận phân quyền Drive (`findAll` trong `DriveService`)**: Chặn triệt để member thường xem tài nguyên `EXECUTIVE_ONLY` và tài nguyên `DEPARTMENT_ONLY` của ban khác.
- [x] **Public Endpoints**: `/cms/stats` và `/cms/events` truy cập công khai không yêu cầu token đăng nhập.

### ⚡ B. Hiệu năng & Thống kê Tự Động
- [x] **Snapshot số liệu kỳ cũ**: Tự động tổng hợp chính xác số lượng task, tổng Gems đã duyệt hoàn thành, số lượng thành viên và sự kiện.
- [x] **Realtime CMS Stats**: Tự động tính toán số liệu thống kê tác động từ Database nếu chưa set giá trị ghi đè thủ công.

---

## 🧪 3. Kịch Bản Kiểm Thử Nhanh (Step-by-Step Test Scenarios)

### 🔹 Bước 1: Khởi động Server
```powershell
cd d:\GDG-Management\backend
npm run start:dev
```
Truy cập Swagger Docs tại: **`http://localhost:8080/api/docs`**

---

### 🔹 Bước 2: Test Lấy Cấu Hình Kỳ & Snapshot (`GET /api/config/generation`)
**Tài khoản:** Bất kỳ Member.  
👉 **Kỳ vọng:** Trả về HTTP 200 gồm `currentTenure`, các cờ trạng thái `allowTaskSubmission`, `freezeLeaderboard` và danh sách `archivedTenures` kèm snapshot số liệu.

---

### 🔹 Bước 3: Test Chuyển Giao Nhiệm Kỳ (`POST /api/config/generation/transition`)
**Tài khoản:** `LEAD`  
**Payload mẫu:**
```json
{
  "newTenureName": "Spring 2027",
  "newGenLabel": "Gen 4.5",
  "startDate": "2027-02-01T00:00:00.000Z",
  "endDate": "2027-06-30T23:59:59.000Z",
  "carryOverCoreTeam": true,
  "notifyAllMembers": true,
  "chapterLead": "Trần Nguyên Bảo"
}
```
👉 **Kỳ vọng:**
1. Trả về HTTP 200 thông tin kỳ mới và snapshot kỳ cũ.
2. Kỳ cũ chuyển sang `isFrozen: true`, `isArchived: true`.
3. Bảng `notifications` có thông báo Broadcast URGENT chào mừng kỳ mới.
4. Bảng `user_tenures` có các bản ghi Core Team được kế thừa sang kỳ mới.

---

### 🔹 Bước 4: Test Đăng Ký Tài Nguyên Drive (`POST /api/assets`)
**Tài khoản:** `LEAD` hoặc `DEPARTMENT_LEAD`.  
**Payload mẫu:**
```json
{
  "name": "Brand Kit GDGoC 2026 - Logo & Mockups",
  "category": "BRAND_KIT",
  "driveUrl": "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz",
  "driveFileId": "1AbCdEfGhIjKlMnOpQrStUvWxYz",
  "accessLevel": "INTERNAL_MEMBER"
}
```
👉 **Kỳ vọng:** Trả về HTTP 201 bản ghi `DriveAsset`.

---

### 🔹 Bước 5: Test Phân Quyền Xem Drive Assets (`GET /api/assets`)
1. Tạo 1 asset với `accessLevel: "EXECUTIVE_ONLY"`.
2. Dùng tài khoản `MEMBER` thường gọi `GET /api/assets` -> Không thấy asset này trong danh sách.
3. Dùng tài khoản `LEAD` gọi `GET /api/assets` -> Thấy đầy đủ tất cả tài nguyên.

---

### 🔹 Bước 6: Test Landing CMS Stats (`GET /api/cms/stats`)
**Không cần token (Public):** Gọi `GET /api/cms/stats` -> Trả về mảng 4 milestone stats với màu sắc Google chuẩn (`#4285F4`, `#34A853`, `#FBBC05`, `#EA4335`).
