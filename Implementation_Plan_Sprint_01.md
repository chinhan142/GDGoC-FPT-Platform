# Kế hoạch Thực hiện Sprint 01 (Implementation Plan)
**Phân hệ:** Database Schema v1.1 Upgrade, Standard API Envelopes, Cookie-Based Authentication & RBAC Core  
**Thời gian thực hiện:** 21/09/2026  
**Người phụ trách:** Web Lead + AI Co-Pilot  

---

## 1. Mục tiêu & Bối cảnh (Objectives & Context)
- Nâng cấp Database Schema từ v1.0 lên **v1.1** để đồng bộ hóa hoàn toàn với Frontend GDGoC Portal:
  - Bổ sung vai trò cố vấn `ADVISOR` (quyền view-only toàn hệ thống).
  - Chuẩn hóa 7 ban chuyên môn (`EXECUTIVE`, `TECH_AI`, `TECH_CLOUD`, `TECH_WEB`, `TECH_RESEARCH`, `MEDIA`, `HR_EVENT`).
  - Thêm các models: `Notification`, `NotificationRead`, `InventoryItem`, `GiftItem`, `GiftRedemption`.
  - Bổ sung các metadata fields: `skills`, `bio`, `position`, `genLabel`, `chapterLead`, `bannerImageUrl`, `registrationUrl`, `isPublic`.
- Chuẩn hóa định dạng phản hồi API theo chuẩn API Contract:
  - Thành công: `{ "data": <payload>, "message": "Success" }`
  - Thất bại: `{ "error": "<error_code>", "message": "<human-readable message>" }`
- Chuyển đổi phương thức xác thực từ JWT Bearer sang **HttpOnly Cookie** (`session_token`) để bảo vệ người dùng khỏi tấn công XSS và tương thích trực tiếp với luồng `fetch('/api/auth/me')` trên Frontend.

---

## 2. Tiêu chuẩn Bảo mật & Môi trường (Security & Environment Compliance)
- ❌ **Tuyệt đối không hardcode bí mật / biến môi trường**: Tất cả JWT Secret, Database URLs, Webhook Secret, Private Keys phải được đọc an toàn từ `process.env` hoặc `ConfigService`.
- 🔒 **Cookie Security Best Practices**:
  - `httpOnly: true`: Ngăn chặn JavaScript phía client truy cập vào cookie qua `document.cookie`, triệt tiêu rủi ro rò rỉ token qua XSS.
  - `sameSite: 'lax'`: Bảo vệ chống tấn công CSRF (Cross-Site Request Forgery).
  - `secure: process.env.NODE_ENV === 'production'`: Tự động bật truyền tải qua HTTPS khi deploy Production.
  - `path: '/'`: Đảm bảo cookie được gửi kèm mọi request đến domain API.
- 🛡️ **Password Hashing**: Mật khẩu luôn được hash bằng `bcrypt` với Salt Rounds = 10, không bao giờ lưu trữ hoặc log plaintext password.

---

## 3. Kiến trúc Kỹ thuật & Chi tiết Thay đổi (Technical Design)

### 3.1. Database Layer (Prisma ORM)
- **Tập tin:** `backend/prisma/schema.prisma`
- Đồng bộ hóa toàn bộ enums và models v1.1.
- Áp dụng cấu hình `prisma.config.ts` tương thích Prisma 7.x Serverless Adapter (`@prisma/adapter-pg`).

### 3.2. Response Envelope & Exception Filter
- **Tập tin:** `backend/src/modules/common/interceptors/transform.interceptor.ts`
  - Bắt toàn bộ dữ liệu trả về từ NestJS Controller và bọc vào cấu trúc `{ data, message }`.
  - Tránh double-wrapping nếu controller đã trả về cấu trúc có sẵn `message` hoặc `data`.
- **Tập tin:** `backend/src/modules/common/filters/http-exception.filter.ts`
  - Bắt toàn bộ ngoại lệ (`HttpException` hoặc Unhandled Errors) và định dạng về `{ error, message }`.

### 3.3. Authentication & RBAC Engine
- **Tập tin:** `backend/src/modules/auth/auth.service.ts` & `auth.controller.ts`
  - `POST /api/auth/login`: Xác thực email/password, cấp phát JWT qua `res.cookie('session_token', token, ...)` và trả về profile kèm `currentTenure`.
  - `GET /api/auth/me`: Trích xuất token từ Cookie (hoặc Bearer), trả về session và tenure của user hiện tại.
  - `POST /api/auth/logout`: Xóa `session_token` cookie.
  - `POST /api/auth/change-password`: Đổi mật khẩu có xác thực mật khẩu cũ.
- **Tập tin:** `backend/src/modules/auth/strategies/jwt.strategy.ts`
  - Sử dụng hàm extractor tùy biến để ưu tiên đọc `req.cookies['session_token']`, dự phòng đọc Authorization Bearer header.
- **Tập tin:** `backend/src/modules/common/guards/roles.guard.ts`
  - Kiểm tra quyền truy cập dựa trên `UserTenure.role` trong nhiệm kỳ hiện tại (`isFrozen = false`).

---

## 4. Kế hoạch Kiểm thử & Nghiệm thu (Verification Plan)
1. **Biên dịch mã nguồn**: `npm run build` không phát sinh lỗi TypeScript.
2. **Database Sync**: Chạy `npx prisma db push --force-reset` và `npm run seed` thành công 7 ban và 1 tenure active.
3. **Swagger Docs & API Testing**: Kiểm tra Swagger Docs tại `http://localhost:8080/api/docs`.
