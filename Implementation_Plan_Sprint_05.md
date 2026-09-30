# Kế hoạch Thực hiện Sprint 05 (Implementation Plan)
**Phân hệ:** Sổ Cái Giao Dịch Gems & Cửa Hàng Quà Tặng (Gems Ledger & Gift Shop)  
**Thời gian thực hiện:** 23/09/2026 (Block 50 phút)  
**Người phụ trách:** Web Lead + AI Co-Pilot  

---

## 1. Mục tiêu & Bối cảnh (Objectives & Context)

Xây dựng toàn diện phân hệ **Gamification & Kinh tế Gems nội bộ** gồm 2 module cốt lõi:
1. **Sổ Cái Giao Dịch Gems (`GemsModule`)**: Quản lý lịch sử giao dịch bất biến (`GemsTransaction`) theo chuẩn ACID, tính toán Bảng xếp hạng vinh danh (`Leaderboard`), thống kê mức tăng trưởng (`delta`) theo tuần, và công cụ điều chỉnh thưởng/phạt thủ công dành cho Ban Chủ Nhiệm (`LEAD`).
2. **Cửa Hàng Quà Tặng (`GiftsModule`)**: Quản lý kho quà lưu niệm/merchandise (`GiftItem`), luồng gửi yêu cầu đổi quà (`POST /gifts/redeem`), kiểm tra số dư tức thời, trừ Gems và tồn kho nguyên tử trong Database Transaction, cùng quy trình BCN phê duyệt / bàn giao quà tặng (`PATCH /gifts/redemptions/:id/status`).

---

## 2. Tiêu chuẩn Bảo mật & Môi trường (Security & Compliance Mandates)

- 🔒 **Không hardcode biến môi trường / Secrets**: Tuyệt đối đọc thông tin nhạy cảm qua `ConfigService`.
- 🍪 **Xác thực Cookie an toàn**: Mọi request nội bộ bắt buộc đi qua `JwtAuthGuard` (HttpOnly Cookie `session_token`).
- ⚡ **Phân quyền RBAC nghiêm ngặt**:
  - `LEAD`: Quyền tối cao xem lịch sử Gems của tất cả thành viên, thực hiện điều chỉnh Gems (`POST /gems/adjust`), CRUD danh mục quà tặng (`POST`, `PUT`, `DELETE /gifts`), và phê duyệt đơn đổi quà (`PATCH /gifts/redemptions/:id/status`).
  - `MEMBER` & `DEPARTMENT_LEAD`: Xem bảng xếp hạng, xem lịch sử giao dịch của chính mình, đổi quà (`POST /gifts/redeem`), xem danh sách đơn đổi quà của mình.
  - `ADVISOR`: Quyền xem (Read-only), không tham gia giao dịch hay đổi quà.
- 🛡️ **Bảo vệ Giao dịch ACID & Idempotency Key**:
  - Mọi thao tác biến động số dư Gems và tồn kho quà tặng bắt buộc thực thi trong Prisma Interactive Transaction (`prisma.$transaction`).
  - Mọi bản ghi `GemsTransaction` đều có `idempotencyKey` duy nhất, ngăn ngừa 100% gian lận hoặc double-spending khi mạng chập chờn.
  - Xử lý hoàn Gems tự động nếu BCN từ chối (`REJECTED`) đơn đổi quà.

---

## 3. Kiến trúc Kỹ thuật & Chi tiết Triển khai (Technical Design)

### 3.1. Cấu trúc Module (`GemsModule` & `GiftsModule`)
```
backend/src/modules/
├── gems/
│   ├── dto/
│   │   ├── query-leaderboard.dto.ts      # Query lọc Leaderboard (tenureId, departmentCode, limit)
│   │   ├── query-transactions.dto.ts     # Query lịch sử giao dịch (userId, page, limit)
│   │   └── adjust-gems.dto.ts            # DTO điều chỉnh Gems thủ công (+ / -)
│   ├── gems.controller.ts                # Controller RESTful chuẩn API Contract
│   ├── gems.service.ts                   # Service xử lý Leaderboard, delta & ACID Ledger
│   └── gems.module.ts                    # Module NestJS kết nối Prisma & Auth
└── gifts/
    ├── dto/
    │   ├── create-gift.dto.ts            # DTO tạo quà tặng mới (name, gemsPrice, stock, imageUrl)
    │   ├── update-gift.dto.ts            # DTO cập nhật quà tặng
    │   ├── redeem-gift.dto.ts            # DTO gửi yêu cầu đổi quà
    │   ├── query-redemptions.dto.ts      # DTO lọc danh sách đơn đổi quà
    │   └── update-redemption-status.dto.ts # DTO duyệt/từ chối đơn đổi quà
    ├── gifts.controller.ts               # Controller RESTful quản lý Gift Shop & Redemptions
    ├── gifts.service.ts                  # Service xử lý kho, trừ Gems & hoàn Gems khi Reject
    └── gifts.module.ts                   # Module NestJS kết nối Prisma & Auth
```

### 3.2. Đặc tả Chi tiết Endpoints

#### 1. `GET /api/gems/leaderboard`
- **Auth:** `JwtAuthGuard`
- **Query DTO (`QueryLeaderboardDto`)**:
  - `tenureId?: string` (mặc định lấy kỳ active gần nhất)
  - `departmentCode?: DepartmentType`
  - `limit?: number = 20`
- **Logic Service**:
  - Lấy danh sách thành viên trong nhiệm kỳ, sắp xếp theo `gemsBalance DESC`.
  - Tính toán `rank` (1, 2, 3...) và `delta` (tổng Gems nhận được từ `GemsTransaction` loại `amount > 0` trong 7 ngày gần nhất).
  - Trả về format: `{ updatedAt: Date, isFrozen: boolean, rankings: [...] }`.

#### 2. `GET /api/gems/transactions`
- **Auth:** `JwtAuthGuard`
- **Query DTO (`QueryTransactionsDto`)**:
  - `userId?: string` (Nếu không truyền: lấy của user hiện tại. Nếu truyền `userId` khác: chỉ `LEAD` mới có quyền).
  - `page?: number = 1`
  - `limit?: number = 20`
- **Logic Service**:
  - Trả về `{ balance: user.gemsBalance, transactions: [...] }` kèm phân trang.

#### 3. `POST /api/gems/adjust`
- **Auth:** `JwtAuthGuard`, `RolesGuard` (`LEAD` only)
- **Body DTO (`AdjustGemsDto`)**:
  - `userId: string`
  - `amount: number` (Dương: thưởng, Âm: phạt)
  - `reason: string`
- **Logic Service**:
  - Kiểm tra tồn tại user.
  - Nếu `amount < 0` và `user.gemsBalance + amount < 0`: Báo lỗi không đủ số dư để phạt.
  - Thực thi trong `$transaction`: Tạo `GemsTransaction` (`type: MANUAL_ADJUSTMENT`) và cập nhật `gemsBalance`.

#### 4. `GET /api/gifts` & `POST /api/gifts` & `PUT /api/gifts/:id` & `DELETE /api/gifts/:id`
- **Auth:** `GET` (Mọi member), `POST/PUT/DELETE` (`LEAD` only)
- **Logic Service**: Quản trị danh mục quà tặng (`name`, `description`, `imageUrl`, `gemsPrice`, `stock`, `isActive`).

#### 5. `POST /api/gifts/redeem` (Đổi Quà)
- **Auth:** `JwtAuthGuard`
- **Body DTO (`RedeemGiftDto`)**: `{ "giftItemId": string }`
- **Logic Service**:
  - Kiểm tra quà tặng tồn tại, `isActive === true`, và `stock > 0`.
  - Kiểm tra `user.gemsBalance >= giftItem.gemsPrice`.
  - Thực thi trong `$transaction` nguyên tử:
    - Giảm `user.gemsBalance -= giftItem.gemsPrice`.
    - Giảm `giftItem.stock -= 1`.
    - Tạo `GemsTransaction` (`type: GIFT_REDEMPTION`, `amount: -giftItem.gemsPrice`, `reason: "Đổi quà tặng: ${giftItem.name}"`).
    - Tạo `GiftRedemption` (`status: PENDING`, `gemsSpent: giftItem.gemsPrice`).

#### 6. `GET /api/gifts/redemptions` & `PATCH /api/gifts/redemptions/:id/status` (Duyệt Đơn Đổi Quà)
- **Auth:** `GET` (Member xem đơn của mình, `LEAD` xem tất cả), `PATCH` (`LEAD` only).
- **Logic Service duyệt đơn**:
  - Khi Lead chuyển sang `APPROVED` hoặc `DELIVERED`: Cập nhật `status`, `approvedById = reviewerId`, `notes`.
  - Khi Lead chuyển sang `REJECTED`: Tự động hoàn lại `gemsBalance += redemption.gemsSpent`, hoàn lại `stock += 1`, và ghi nhận giao dịch hoàn tiền `MANUAL_ADJUSTMENT`.

---

## 4. Kế hoạch Kiểm thử & Nghiệm thu (Verification Plan)

### 4.1. Automated Build Check
- Chạy `npm run build` đảm bảo không lỗi TypeScript, decorators hay Prisma relations.

### 4.2. Functional & Transactional Verification
1. **Kiểm tra Leaderboard**: Gọi `GET /api/gems/leaderboard` -> Kiểm tra thứ hạng, điểm số và tính toán `delta` 7 ngày gần nhất.
2. **Kiểm tra Điều chỉnh Gems**: Gọi `POST /api/gems/adjust` -> Kiểm tra số dư cập nhật và bản ghi sổ cái được tạo. Thử trừ quá số dư -> Báo lỗi chặn hợp lý.
3. **Kiểm tra Đổi quà & Trừ Gems tức thì**:
   - Gọi `POST /api/gifts/redeem` -> Số dư Gems bị trừ ngay, tồn kho `stock` giảm 1, đơn đổi quà chuyển sang `PENDING`.
4. **Kiểm tra Từ chối đơn & Hoàn Gems**:
   - Gọi `PATCH /api/gifts/redemptions/:id/status` với `status: REJECTED` -> Kiểm tra Gems được hoàn lại 100% cho người dùng và `stock` tăng lại 1.
