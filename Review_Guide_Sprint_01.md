# Hướng Dẫn Kiểm Tra & Đánh Giá Mã Nguồn (Code Review Guide)
**Tên Sprint:** Sprint 01 — Database Schema v1.1, API Response Envelopes & Cookie-Based Authentication  
**Mục đích:** Hướng dẫn Web Lead từng bước rà soát mã nguồn (code review) theo thứ tự logic kiến trúc từ tầng thấp (Database) lên tầng cao (Controller & Security), phục vụ việc nghiệm thu kỹ thuật và kiểm tra nghiệp vụ.

---

## 🧭 Thứ Tự Rà Soát Khuyến Nghị (Step-by-Step Review Order)

Để có cái nhìn liền mạch và dễ hiểu nhất, bạn nên mở và kiểm tra các tệp theo thứ tự 6 bước sau:

```
[1. Database Schema] ──► [2. Prisma Seed] ──► [3. Transform Interceptor]
                                                      │
                                                      ▼
[6. Auth Controller] ◄── [5. Auth Service] ◄── [4. JWT Strategy & Filter]
```

---

### 📍 Bước 1: Kiểm tra Cấu trúc Cơ sở dữ liệu (Database Layer)
- **Tập tin:** [`backend/prisma/schema.prisma`](file:///d:/GDG-Management/backend/prisma/schema.prisma)
- **Điểm kỹ thuật cần soi:**
  1. `enum Role`: Xem đã có đủ 5 role (`ADVISOR`, `LEAD`, `DEPARTMENT_LEAD`, `MEMBER`, `COLLABORATOR`) chưa.
  2. `enum DepartmentType`: Kiểm tra 7 ban mới (`EXECUTIVE`, `TECH_AI`, `TECH_CLOUD`, `TECH_WEB`, `TECH_RESEARCH`, `MEDIA`, `HR_EVENT`).
  3. `model UserTenure`: Kiểm tra các trường `skills String[]`, `bio String?`, `position String?`.
  4. `model InventoryItem`, `Notification`, `GiftItem`: Kiểm tra các bảng mới có quan hệ khóa ngoại (foreign keys) và index chuẩn không.
- **Tiêu chuẩn nghiệm thu:** Schema biên dịch hợp lệ với Prisma 7.x (`npx prisma generate` không báo lỗi).

---

### 📍 Bước 2: Kiểm tra Dữ liệu Khởi tạo Mẫu (Seed Data)
- **Tập tin:** [`backend/prisma/seed/seed.ts`](file:///d:/GDG-Management/backend/prisma/seed/seed.ts)
- **Điểm kỹ thuật cần soi:**
  1. Xem vòng lặp `upsert` 7 Department có đủ cả `name` (tiếng Việt) và `nameEn` (tiếng Anh) không.
  2. Kiểm tra việc tạo tenure active mặc định: `Fall 2026 - Gen 4.0` (`isFrozen: false`).
- **Cách test thủ công:**
  ```powershell
  cd d:\GDG-Management\backend
  npm run seed
  ```
  Kết quả trả về console thông báo 7 ban và 1 tenure được tạo thành công.

---

### 📍 Bước 3: Kiểm tra Chuẩn Hóa Response Envelope (Global Interceptor)
- **Tập tin:** [`backend/src/modules/common/interceptors/transform.interceptor.ts`](file:///d:/GDG-Management/backend/src/modules/common/interceptors/transform.interceptor.ts)
- **Điểm kỹ thuật cần soi:**
  1. Kiểm tra toán tử RxJS `map()`: Toàn bộ controller return object sẽ được tự động bọc thành `{ data: ..., message: "Success" }`.
  2. Logic chống bọc 2 lần (`double-wrapping`): Kiểm tra xem interceptor có bỏ qua nếu dữ liệu đã có sẵn format chuẩn không.
  3. Xử lý trường hợp `null` / `undefined` (như response 204 No Content).

---

### 📍 Bước 4: Kiểm tra Chuẩn Hóa Lỗi & Chiến Lược Xác Thực (Exception & Auth Strategy)
- **Tập tin 1:** [`backend/src/modules/common/filters/http-exception.filter.ts`](file:///d:/GDG-Management/backend/src/modules/common/filters/http-exception.filter.ts)
  - **Điểm soi:** Xem cách filter bóc tách `HttpException`, mảng lỗi từ `class-validator` và unhandled error thành format `{ error: "<code/name>", message: "<detail>" }`.
- **Tập tin 2:** [`backend/src/modules/auth/strategies/jwt.strategy.ts`](file:///d:/GDG-Management/backend/src/modules/auth/strategies/jwt.strategy.ts)
  - **Điểm soi:**
    - Hàm `cookieOrBearerExtractor`: Ưu tiên bóc tách từ `req.cookies['session_token']`, nếu không có mới fallback sang `ExtractJwt.fromAuthHeaderAsBearerToken()`.
    - Hàm `validate(payload)`: Kiểm tra việc query User kèm quan hệ `tenures` -> `department` & `tenure`.
    - Biến môi trường: `process.env.JWT_SECRET` được bảo vệ, có fallback an toàn cho dev.

---

### 📍 Bước 5: Kiểm tra Nghiệp Vụ Xác Thực (Auth Service)
- **Tập tin:** [`backend/src/modules/auth/auth.service.ts`](file:///d:/GDG-Management/backend/src/modules/auth/auth.service.ts)
- **Điểm nghiệp vụ cần soi:**
  1. `login(dto, res)`:
     - Dùng `bcrypt.compare(dto.password, user.passwordHash)`.
     - Cấp cookie `res.cookie('session_token', accessToken, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7*24*60*60*1000 })`.
     - Lọc `currentTenure` đang hoạt động (`!isFrozen`) để trả về role và ban chính xác.
  2. `getMe(user)`:
     - Trả về đúng session envelope: `id`, `email`, `fullName`, `mssv`, `gemsBalance`, `currentTenure`.
  3. `logout(res)`:
     - `res.clearCookie('session_token', { httpOnly: true, path: '/' })`.
  4. `changePassword(dto, userId)`:
     - So khớp `oldPassword` trước khi hash `newPassword` và update vào database.

---

### 📍 Bước 6: Kiểm tra Điểm Tiếp Nhận Request (Auth Controller & Main Entry)
- **Tập tin 1:** [`backend/src/modules/auth/auth.controller.ts`](file:///d:/GDG-Management/backend/src/modules/auth/auth.controller.ts)
  - **Điểm soi:**
    - Xem việc sử dụng `@Res({ passthrough: true })` để NestJS vẫn xử lý lifecycle return qua Interceptor.
    - Xem Swagger decorators (`@ApiCookieAuth`, `@ApiTags`, `@ApiOperation`).
- **Tập tin 2:** [`backend/src/main.ts`](file:///d:/GDG-Management/backend/src/main.ts)
  - **Điểm soi:**
    - `app.use(cookieParser())` đã được khai báo trước routes.
    - `app.setGlobalPrefix('api')` đã khớp với Frontend (`fetch('/api/auth/me')`).
    - `app.useGlobalInterceptors(new TransformInterceptor())` và `app.useGlobalFilters(new AllExceptionsFilter())`.

---

## 🧪 Kịch Bản Test Nhanh Cho Web Lead (Quick Test Checklist)

Bạn có thể mở terminal và chạy lệnh khởi động backend để test:

```powershell
cd d:\GDG-Management\backend
npm run start:dev
```

1. **Test Swagger UI:** Truy cập trình duyệt `http://localhost:8080/api/docs` để thấy Swagger hiển thị đầy đủ các endpoints với Cookie Auth `session_token`.
2. **Test Build:**
   ```powershell
   npm run build
   ```
   Kết quả trả về `Exit code: 0` và không có bất kỳ warning/error TypeScript nào.
