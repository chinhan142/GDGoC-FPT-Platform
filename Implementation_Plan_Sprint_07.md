# Kế hoạch Thực hiện Sprint 07 (Implementation Plan)
**Phân hệ:** Cấu Hình Niên Khóa, Quản Trị Drive Assets & Landing CMS (Generation Config, Drive & CMS)  
**Thời gian thực hiện:** 23/09/2026 (Block 50 phút)  
**Người phụ trách:** Web Lead + AI Co-Pilot  

---

## 1. Mục tiêu & Bối cảnh (Objectives & Context)

Xây dựng toàn diện 3 phân hệ cấu hình và tài nguyên cốt lõi cho GDGoC Portal:
1. **Quản Trị Niên Khóa & Chuyển Giao Kỳ (`TenuresModule` / `/config/generation`)**:
   - `GET /config/generation`: Lấy thông tin nhiệm kỳ hiện tại (`currentTenure`), trạng thái đóng băng (`isFrozen`), và danh sách các nhiệm kỳ lưu trữ quá khứ (`archivedTenures`) kèm snapshot thống kê (tổng task, tổng Gems, số thành viên, số sự kiện).
   - `PUT /config/generation`: Cập nhật cấu hình nhiệm kỳ (`isFrozen`, `allowTaskSubmission`, `allowRsvp`, `freezeLeaderboard`, `chapterLead`).
   - `POST /config/generation/transition`: **Hero Feature** - Thực hiện chuyển giao nhiệm kỳ (Đóng băng & lưu trữ kỳ cũ, tính toán snapshot số liệu, khởi tạo nhiệm kỳ mới, tự động kế thừa Core Team `carryOverCoreTeam` và phát thông báo toàn CLB `notifyAllMembers`).
2. **Quản Lý Tài Nguyên Google Drive (`DriveModule` / `/assets`)**:
   - Quản lý tài liệu thương hiệu (`BRAND_KIT`), thư viện công nghệ (`TECH_LIBRARY`), kho media (`MEDIA_VAULT`), PR & Comms (`PR_COMMS`), tài chính (`FINANCE`), và tài liệu bàn giao (`HANDOVER_VAULT`).
   - Phân quyền truy cập 4 cấp độ: `PUBLIC` (công khai), `INTERNAL_MEMBER` (nội bộ), `DEPARTMENT_ONLY` (chỉ ban tương ứng), `EXECUTIVE_ONLY` (chỉ BCN).
3. **Quản Trị Nội Dung Landing Page (`CmsModule` / `/cms`)**:
   - `GET /cms/stats` & `PUT /cms/stats`: Số liệu thống kê tác động (Impact Milestones) hiển thị trên Landing Page.
   - `GET /cms/events`: Endpoint công khai lấy danh sách sự kiện public.

---

## 2. Tiêu chuẩn Bảo mật & Môi trường (Security & Compliance Mandates)

- 🔒 **Không hardcode biến môi trường / Secrets**: Tuyệt đối đọc thông tin cấu hình qua `ConfigService`.
- 🍪 **Xác thực Cookie an toàn**: Mọi request nội bộ bắt buộc đi qua `JwtAuthGuard` (HttpOnly Cookie `session_token`), mở public cho `/cms/stats` và `/cms/events`.
- ⚡ **Phân quyền RBAC nghiêm ngặt**:
  - `LEAD`: Toàn quyền chuyển giao nhiệm kỳ (`transition`), chỉnh sửa config kỳ, cập nhật CMS stats, xem tài nguyên `EXECUTIVE_ONLY`.
  - `DEPARTMENT_LEAD`: Quản lý tài nguyên Drive của ban mình (`DEPARTMENT_ONLY`).
  - `MEMBER`: Xem tài nguyên `PUBLIC` và `INTERNAL_MEMBER`.
  - `ADVISOR`: Xem tất cả tài nguyên nội bộ.

---

## 3. Kiến trúc Kỹ thuật & Chi tiết Triển khai (Technical Design)

### 3.1. Cấu trúc Module (`TenuresModule`, `DriveModule`, `CmsModule`)
```
backend/src/modules/
├── tenures/
│   ├── dto/
│   │   ├── update-tenure-config.dto.ts    # DTO cập nhật cấu hình kỳ hiện tại
│   │   └── transition-tenure.dto.ts       # DTO chuyển giao nhiệm kỳ mới
│   ├── tenures.controller.ts              # Controller cho /config/generation & /tenures
│   ├── tenures.service.ts                 # Service xử lý snapshot & chuyển giao kỳ
│   └── tenures.module.ts                  # Module NestJS
├── drive/
│   ├── dto/
│   │   ├── create-asset.dto.ts            # DTO tạo tài nguyên Drive
│   │   ├── update-asset.dto.ts            # DTO cập nhật tài nguyên
│   │   └── query-assets.dto.ts            # DTO lọc tài nguyên theo category, accessLevel, ban
│   ├── drive.controller.ts                # Controller cho /assets & /drive
│   ├── drive.service.ts                   # Service xử lý CRUD tài nguyên & phân quyền xem
│   └── drive.module.ts                    # Module NestJS
└── cms/
    ├── dto/
    │   └── update-stats.dto.ts            # DTO cập nhật milestone impact stats
    ├── cms.controller.ts                  # Controller cho /cms/stats & /cms/events
    ├── cms.service.ts                     # Service thống kê realtime & lưu trữ stats
    └── cms.module.ts                      # Module NestJS
```

### 3.2. Đặc tả Chi tiết Endpoints

#### 1. `GET /api/config/generation`
- **Auth:** `JwtAuthGuard`
- **Logic Service**:
  - Lấy tenure đang active gần nhất.
  - Lấy danh sách các tenure cũ (`isArchived === true` hoặc `id !== currentTenure.id`).
  - Thống kê snapshot cho mỗi tenure cũ: `totalTasks`, `totalGems` (tổng gems reward của task DONE), `membersCount`, `eventsCount`.
  - Trả về cấu trúc chuẩn API Contract: `{ currentTenure, allowTaskSubmission, allowRsvp, freezeLeaderboard, archivedTenures }`.

#### 2. `PUT /api/config/generation`
- **Auth:** `JwtAuthGuard`, `RolesGuard` (`LEAD` only)
- **Body DTO (`UpdateTenureConfigDto`)**: `{ isFrozen?, allowTaskSubmission?, allowRsvp?, freezeLeaderboard?, chapterLead? }`
- **Logic Service**: Cập nhật tenure active.

#### 3. `POST /api/config/generation/transition`
- **Auth:** `JwtAuthGuard`, `RolesGuard` (`LEAD` only)
- **Body DTO (`TransitionTenureDto`)**:
  - `newTenureName: string` (ví dụ: "Spring 2027")
  - `newGenLabel: string` (ví dụ: "Gen 4.5")
  - `startDate: string`
  - `endDate: string`
  - `carryOverCoreTeam?: boolean` (mặc định `true`)
  - `notifyAllMembers?: boolean` (mặc định `true`)
  - `chapterLead?: string`
- **Logic Service trong `$transaction`**:
  1. Archive tenure cũ: `isFrozen: true`, `isArchived: true`.
  2. Tạo tenure mới với `isFrozen: false`, `isArchived: false`.
  3. Nếu `carryOverCoreTeam === true`: Tìm các `UserTenure` thuộc BCN (`LEAD`, `DEPARTMENT_LEAD`) của kỳ cũ, tạo record `UserTenure` tương ứng cho kỳ mới.
  4. Nếu `notifyAllMembers === true`: Tạo bản ghi `Notification` broadcast thông báo chào mừng nhiệm kỳ mới.
  5. Tính toán snapshot kỳ cũ và trả về `{ archived: { tenureId, snapshot }, newTenure }`.

#### 4. `GET /api/assets`
- **Auth:** `JwtAuthGuard`
- **Query DTO (`QueryAssetsDto`)**: `category`, `departmentCode`, `eventId`, `accessLevel`, `search`, `page`, `limit`
- **Logic Service Phân quyền**:
  - `LEAD`: Xem được toàn bộ (`PUBLIC`, `INTERNAL_MEMBER`, `DEPARTMENT_ONLY`, `EXECUTIVE_ONLY`).
  - `ADVISOR`: Xem được `PUBLIC`, `INTERNAL_MEMBER`, `DEPARTMENT_ONLY`.
  - `MEMBER`: Xem được `PUBLIC`, `INTERNAL_MEMBER`, và `DEPARTMENT_ONLY` (nếu asset thuộc ban của mình).

#### 5. `POST /api/assets` & `PUT /api/assets/:id` & `DELETE /api/assets/:id`
- **Auth:** `LEAD`, `DEPARTMENT_LEAD`
- **Logic Service**: Quản trị tài nguyên Google Drive (`name`, `category`, `driveUrl`, `driveFileId`, `accessLevel`, `departmentId`, `tenureId`, `eventId`).

#### 6. `GET /api/cms/stats` & `PUT /api/cms/stats` & `GET /api/cms/events`
- **Auth:** `GET` (Public), `PUT` (`LEAD` only)
- **Logic Service**:
  - `GET /cms/stats`: Trả về số liệu impact stats (lấy từ dữ liệu thống kê realtime hoặc config tuỳ chỉnh).
  - `PUT /cms/stats`: Cập nhật nội dung các thẻ milestone.
  - `GET /cms/events`: Trả về danh sách sự kiện `isPublic = true`.

---

## 4. Kế hoạch Kiểm thử & Nghiệm thu (Verification Plan)

### 4.1. Automated Build Check
- Chạy `npm run build` trong `backend` đảm bảo không có bất kỳ lỗi biên dịch nào.

### 4.2. Functional & RBAC Verification
1. **Kiểm tra Config Kỳ Hiện Tại**: Gọi `GET /api/config/generation` -> Trả về đúng `currentTenure` và `archivedTenures` kèm snapshot.
2. **Kiểm tra Chuyển Giao Nhiệm Kỳ (`transition`)**:
   - Gọi `POST /api/config/generation/transition` -> Kỳ cũ được archive, kỳ mới được tạo, Core Team được tự động sao chép sang kỳ mới.
3. **Kiểm tra Phân Quyền Drive Assets**:
   - Member thường không xem được asset loại `EXECUTIVE_ONLY`.
   - Member ban Web không xem được asset loại `DEPARTMENT_ONLY` của ban AI.
   - Lead xem được 100% tài nguyên.
4. **Kiểm tra CMS Stats**: Gọi `GET /api/cms/stats` không cần token -> Trả về dữ liệu thành công.
