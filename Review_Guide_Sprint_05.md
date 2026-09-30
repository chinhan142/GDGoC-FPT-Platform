# 🧐 GDGoC Platform — Hướng Dẫn Nghiệm Thu Code Sprint 05 (Review Guide)
**Dành cho:** Web Lead  
**Phân hệ:** Sổ Cái Giao Dịch Gems & Cửa Hàng Quà Tặng (Gems Ledger & Gift Shop)  
**Thời gian:** 23/09/2026  

---

## 🎯 1. Thứ Tự Rà Soát Code Logic (Bottom-Up Review Flow)

Vui lòng duyệt qua các tệp mã nguồn theo thứ tự từ dưới lên:

```
1. Gems Module
   ├── dto/
   │   ├── query-leaderboard.dto.ts
   │   ├── query-transactions.dto.ts
   │   └── adjust-gems.dto.ts
   ├── gems.service.ts
   ├── gems.controller.ts
   └── gems.module.ts

2. Gifts Module
   ├── dto/
   │   ├── create-gift.dto.ts
   │   ├── update-gift.dto.ts
   │   ├── redeem-gift.dto.ts
   │   ├── query-redemptions.dto.ts
   │   └── update-redemption-status.dto.ts
   ├── gifts.service.ts
   ├── gifts.controller.ts
   └── gifts.module.ts
```

---

## 🔍 2. Checklist Các Điểm Kỹ Thuật & Nghiệp Vụ Cần Soi Kỹ

### 🛡️ A. Bảo mật & Tính Toàn Vẹn ACID
- [x] **Giao dịch Nguyên tử khi Đổi quà (`redeemGift`)**: Trừ `gemsBalance`, trừ `stock`, tạo `GemsTransaction` và tạo `GiftRedemption` cùng nằm trong một `prisma.$transaction`.
- [x] **Cơ chế Hoàn tiền khi Từ chối (`updateRedemptionStatus`)**: Khi Lead chuyển đơn sang `REJECTED`, Gems được hoàn lại đầy đủ cho user và tồn kho `stock` được hoàn lại 1.
- [x] **Chặn phạt âm quá số dư (`adjustGems`)**: Báo lỗi `BadRequestException` nếu `amount < 0` mà lớn hơn số dư hiện có.
- [x] **Bảo vệ quyền riêng tư lịch sử giao dịch**: Thành viên chỉ xem được giao dịch của mình, chỉ `LEAD` mới có thể xem của người khác.

### ⚡ B. Hiệu năng & Thống kê Gamification
- [x] **Tính toán Delta tuần**: Bảng xếp hạng tự động tổng hợp các giao dịch cộng Gems trong 7 ngày gần nhất để hiển thị mức tăng trưởng `+X tuần này`.
- [x] **Hỗ trợ Đóng băng Leaderboard**: Trả về cờ `isFrozen` theo trạng thái của nhiệm kỳ (`Tenure`).

---

## 🧪 3. Kịch Bản Kiểm Thử Nhanh (Step-by-Step Test Scenarios)

### 🔹 Bước 1: Khởi động Server & Mở Swagger
```powershell
cd d:\GDG-Management\backend
npm run start:dev
```
Truy cập Swagger Docs tại: **`http://localhost:8080/api/docs`**

---

### 🔹 Bước 2: Test Thêm Quà Tặng Mới (`POST /api/gifts`)
**Tài khoản:** `LEAD`  
**Payload mẫu:**
```json
{
  "name": "Áo Hoodie GDGoC FPTU 2026 Limited",
  "description": "Áo khoác hoodie nỉ ngoại cao cấp in logo Google Developer Groups",
  "imageUrl": "https://images.unsplash.com/photo-1556905055-8f358a7a47b2",
  "gemsPrice": 300,
  "stock": 5,
  "isActive": true
}
```
👉 **Kỳ vọng:** Trả về HTTP 201 bản ghi `GiftItem`.

---

### 🔹 Bước 3: Test Xem Danh Mục Quà Tặng (`GET /api/gifts`)
👉 **Kỳ vọng:** Trả về danh sách quà tặng kèm thông tin giá Gems và số lượng tồn kho.

---

### 🔹 Bước 4: Test Đổi Quà Tặng (`POST /api/gifts/redeem`)
**Tài khoản:** Member có số dư Gems >= 300.  
**Payload mẫu:**
```json
{
  "giftItemId": "<GIFT_ITEM_ID>"
}
```
👉 **Kỳ vọng:**
1. Trả về HTTP 201 đơn đổi quà `GiftRedemption` ở trạng thái `PENDING`.
2. Số dư `gemsBalance` của member bị trừ ngay 300 Gems.
3. Tồn kho `stock` của món quà giảm từ 5 xuống 4.
4. Bảng `gems_transactions` có bản ghi `-300` Gems loại `GIFT_REDEMPTION`.

---

### 🔹 Bước 5: Test Từ Chối Đơn & Tự Động Hoàn Gems (`PATCH /api/gifts/redemptions/:id/status`)
**Tài khoản:** `LEAD`  
**Payload mẫu:**
```json
{
  "status": "REJECTED",
  "notes": "Hết size L, vui lòng chọn sản phẩm khác hoặc liên hệ BCN."
}
```
👉 **Kỳ vọng:**
1. Trả về HTTP 200 đơn ở trạng thái `REJECTED`.
2. Member được hoàn lại 300 Gems vào `gemsBalance`.
3. Tồn kho `stock` của món quà tự động tăng lại từ 4 lên 5.
4. Bảng `gems_transactions` có bản ghi hoàn tiền `+300` Gems.

---

### 🔹 Bước 6: Test Bảng Xếp Hạng & Delta Tuần (`GET /api/gems/leaderboard`)
👉 **Kỳ vọng:** Trả về danh sách xếp hạng có `rank`, `gemsBalance`, và chuỗi `delta` (ví dụ `+150 tuần này`).
