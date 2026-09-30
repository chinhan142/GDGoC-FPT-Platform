# 🚶 Walkthrough — Sprint 10: Frontend-Backend Full Alignment & Contract Harmonization

**Dự án:** GDGoC FPTU HCMC Portal  
**Phân hệ:** Frontend Module Alignment (React 18 + Vite + Zustand + Tailwind CSS)  
**Trạng thái:** ✅ Đã hoàn thành 100% — Zero Type Errors & Clean Production Build.

---

## 🏗️ 1. Danh Sách Tệp Đã Chỉnh Sửa

| STT | Đường Dẫn Tệp | Nội Dung Chỉnh Sửa |
| :---: | :--- | :--- |
| 1 | `src/types/auth.types.ts` | Bổ sung `COLLABORATOR` vào `Tier`. Bổ sung mapping `COLLABORATOR` trong `mapBackendUserToSession`. |
| 2 | `src/types.ts` | Mở rộng kiểu dữ liệu `EventItem`, `OrganizerMember`, `StatMilestone` để hỗ trợ cả CMS và backend DTOs. |
| 3 | `src/store/useMemberStore.ts` | Tự động trích xuất khóa K từ MSSV, bổ sung `tenureId` & `PROBATION` & `COLLABORATOR`, sanitize URL trống khi update profile, chuẩn hóa parse kết quả import Excel. |
| 4 | `src/components/hr/MemberModal.tsx` | Thay trường chọn niên khóa thủ công bằng badge hiển thị tự động `[Khóa Kxx]`, liên kết dropdown `tenureId`, hỗ trợ đầy đủ 5 Roles và 4 Statuses. |
| 5 | `src/components/hr/ExcelImportModal.tsx` | Bổ sung cột `Ban Chuyên Môn` trong template Excel tải về và binding `tenureId` khi upload file. |
| 6 | `src/pages/internal/HRManagement.tsx` | Cập nhật badge hiển thị cho tất cả các Tiers (`ORG_ADMIN`, `ADVISOR`, `BAN_LEAD`, `BAN_MEMBER`, `COLLABORATOR`) và Statuses (`ACTIVE`, `PROBATION`, `ON_LEAVE`, `ALUMNI`). |
| 7 | `src/pages/internal/MyProfile.tsx` | Hiển thị thông báo lỗi chi tiết khi lưu hồ sơ không thành công. |
| 8 | `src/pages/internal/GemsLeaderboard.tsx` | Phẳng hóa dữ liệu leaderboard từ `GET /gems/leaderboard` (`rankings: [{ rank, userId, fullName, mssv, avatarUrl, departmentName, gemsBalance, delta }]`). |
| 9 | `src/pages/internal/DashboardOverview.tsx` | Đồng bộ bảng xếp hạng mini trên Dashboard overview với cấu trúc `rankings`. |
| 10 | `src/pages/internal/EventAttendance.tsx` | Cập nhật `checkinMethod` thành `MANUAL_EVIDENCE`, cập nhật dropdown `EventType`, tối ưu hiển thị danh sách người tham gia và bộ đếm check-in trên Event card. |
| 11 | `src/api/modules/assets.api.ts` | Cập nhật enum `AccessLevel`: `PUBLIC`, `INTERNAL_MEMBER`, `DEPARTMENT_ONLY`, `EXECUTIVE_ONLY`. |
| 12 | `src/pages/internal/AssetHub.tsx` | Cập nhật badge và select option `EXECUTIVE_ONLY` thay thế `CORE_LEAD_ONLY`. |
| 13 | `src/api/modules/events.api.ts` | Bổ sung phân trang `page`, `limit` vào `QueryEventsParams`. |
| 14 | `src/api/modules/cms.api.ts` | Cập nhật các trường tùy chọn trong `MilestoneStatItem`. |
| 15 | `src/components/dev/DevUserSwitcher.tsx` | Bổ sung styling badge cho `COLLABORATOR`. |
| 16 | `src/pages/internal/GenerationSettings.tsx` | Bổ sung import `useEffect` thiếu. |

---

## 🔄 2. Luồng Nghiệp Vụ Đã Đồng Bộ (Business Logic Flow)

```mermaid
flowchart TD
    subgraph Frontend [React + Zustand Frontend]
        A["Member Form (MSSV Input)"] -->|Auto Regex /^[A-Za-z]{2}(\d{2})/| B["Dynamic Cohort (K18, K19, K20...)"]
        B --> C["useMemberStore (Sanitize DTO + tenureId)"]
        D["Profile Edit (Empty string URLs)"] -->|Sanitize to undefined| E["Clean Profile DTO"]
        F["Gems Leaderboard View"] -->|Read flat rankings array| G["Leaderboard Table / Card"]
        H["Event Attendance Check-in"] -->|checkinMethod: MANUAL_EVIDENCE| I["Event Attendance API"]
        J["Asset Hub Drive Form"] -->|accessLevel: EXECUTIVE_ONLY| K["Asset API"]
    end

    subgraph Backend [NestJS + Prisma PostgreSQL]
        C -->|POST /api/members| L["Prisma User & UserTenure"]
        E -->|PUT /api/members/:id/profile| M["@IsUrl Validation Passed"]
        G -->|GET /gems/leaderboard| N["Computed Rankings with Deltas"]
        I -->|POST /api/events/:id/attendees| O["Prisma EventAttendance Record"]
        K -->|POST /api/assets| P["Prisma Asset Record"]
    end
```

---

## 📚 3. Tài Liệu Tham Khảo Chính Thống (Official References)

1. **NestJS Validation Pipe & Class Validator**:  
   [NestJS Validation Techniques](https://docs.nestjs.com/techniques/validation) — Quy chuẩn về `@IsUrl()`, `@IsOptional()`, xử lý chuỗi rỗng và cơ chế sanitize payload.
2. **Prisma Schema Enums & Relations**:  
   [Prisma Enums Reference](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#defining-enums) — Định nghĩa chuẩn Enum trong PostgreSQL/Prisma.
3. **Zustand State Management**:  
   [Zustand Docs](https://zustand.docs.pmnd.rs/) — Quản lý bất biến và đồng bộ hóa Async Actions với REST APIs.
4. **Vite Production Bundler & Tree-shaking**:  
   [Vite Build Guide](https://vitejs.dev/guide/build.html) — Tối ưu hóa compile time và chunking trong TypeScript React projects.
