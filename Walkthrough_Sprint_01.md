# Báo Cáo Kỹ Thuật & Nhật Ký Hoàn Thành Sprint 01
**Tên Sprint:** Sprint 01 — Database Schema v1.1, API Response Envelopes & Cookie-Based Authentication  
**Ngày hoàn thành:** 21/09/2026  
**Mục đích:** Bàn giao tài liệu kiến trúc, luồng xử lý và tài liệu tham khảo chính thống cho Web Lead.

---

## 1. Danh Sách Tệp Mã Nguồn Đã Tạo & Cập Nhật

| Thao tác | Đường dẫn tệp | Mục đích kỹ thuật |
| :--- | :--- | :--- |
| **Cập nhật** | `backend/prisma/schema.prisma` | Nâng cấp toàn diện Schema v1.1 (Enum 7 ban, `ADVISOR` role, models `InventoryItem`, `Notification`, `GiftItem`...). |
| **Cập nhật** | `backend/prisma/seed/seed.ts` | Seed 7 ban chuyên môn + tạo nhiệm kỳ active `Fall 2026 - Gen 4.0`. |
| **Tạo mới** | `backend/src/modules/common/interceptors/transform.interceptor.ts` | Global NestJS Interceptor tự động bọc response `{ "data": ..., "message": "Success" }`. |
| **Tạo mới** | `backend/src/modules/common/filters/http-exception.filter.ts` | Global NestJS Exception Filter chuẩn hóa error response `{ "error": ..., "message": ... }`. |
| **Cập nhật** | `backend/src/main.ts` | Cấu hình prefix `/api`, tích hợp `cookie-parser`, Global Pipes, Interceptor, Filter và Swagger Docs. |
| **Cập nhật** | `backend/src/modules/auth/auth.service.ts` | Xử lý đăng nhập, cấp phát HttpOnly Cookie `session_token`, lấy thông tin user session `getMe`, đăng xuất `logout`. |
| **Cập nhật** | `backend/src/modules/auth/auth.controller.ts` | Định tuyến các endpoint `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/change-password`. |
| **Cập nhật** | `backend/src/modules/auth/strategies/jwt.strategy.ts` | Extractor tùy biến để bóc tách JWT từ HttpOnly Cookie `session_token` hoặc Bearer Header. |
| **Cập nhật** | `backend/src/modules/events/events.service.ts` & `drive.service.ts` | Đồng bộ hóa `DepartmentType` mảng 6 ban chuyên môn theo Schema mới. |

---

## 2. Luồng Nghiệp Vụ & Kiến Trúc Kỹ Thuật (Architecture & Flow)

### 2.1. Luồng Đăng Nhập & Cấp Phát Session Cookie (`POST /api/auth/login`)

```
[ Client (Frontend React) ]
            │
            │  1. POST /api/auth/login (email, password)
            ▼
[ AuthController / AuthService ]
            │
            │  2. Query User & Active Tenure qua Prisma ORM
            ▼
[ Neon PostgreSQL DB ]
            │
            │  3. So khớp passwordHash bằng bcrypt.compare()
            ▼
[ AuthService ]
            │
            │  4. Tạo JWT Payload: { sub: userId, email, mssv }
            │  5. res.cookie('session_token', jwt, { httpOnly: true, sameSite: 'lax', path: '/' })
            ▼
[ TransformInterceptor ]
            │
            │  6. Bọc dữ liệu trả về: { data: UserSession, message: "Success" }
            ▼
[ Client (Trình duyệt) ] ─── Tự động lưu Cookie session_token (Client JS không thể đọc trộm)
```

### 2.2. Luồng Kiểm Tra Phiên Làm Việc (`GET /api/auth/me`)

1. Khi người dùng mở trang web hoặc F5 tải lại trang, `App.tsx` gửi request `fetch('/api/auth/me')`.
2. Trình duyệt **tự động đính kèm cookie `session_token`** trong header request (`credentials: 'include'`).
3. `JwtStrategy` bóc tách token từ `req.cookies['session_token']` và xác thực chữ ký JWT bằng `JWT_SECRET`.
4. Sau khi giải mã payload thành công, Strategy truy vấn User từ DB kèm quan hệ `tenures` -> `department` & `tenure`.
5. `authService.getMe(user)` bóc tách `currentTenure` (nhiệm kỳ đang hoạt động `!isFrozen`), trả về cấu trúc session hoàn chỉnh bao gồm Role, Department Code, Department Name và Gems Balance.

---

## 3. Lý Do Thiết Kế & Biện Pháp Bảo Mật (Security Decisions)

1. **Tại sao chọn HttpOnly Cookie thay vì lưu Token trong `localStorage`?**
   - *Rủi ro của `localStorage`:* Bất kỳ đoạn mã độc hại nào được chèn qua lỗ hổng XSS (Cross-Site Scripting) từ thư viện bên thứ ba (npm packages) đều có thể đọc toàn bộ token trong `localStorage` qua `localStorage.getItem()`.
   - *Giải pháp HttpOnly Cookie:* Cờ `HttpOnly` chỉ định trình duyệt không cho phép bất kỳ script JavaScript nào trên trang truy cập cookie này, ngăn chặn hoàn toàn nguy cơ đánh cắp token qua XSS.
2. **Cờ `SameSite=Lax` & `Secure`**:
   - `SameSite=Lax` bảo vệ ứng dụng khỏi các cuộc tấn công CSRF (Cross-Site Request Forgery) bằng cách ngăn trình duyệt gửi cookie trong các cross-site request nguy hiểm.
   - `Secure` đảm bảo cookie chỉ được gửi qua kết nối mã hóa HTTPS trong môi trường Production.
3. **Cơ chế Fallback cho Swagger & Postman**:
   - `JwtStrategy` hỗ trợ cả `req.cookies['session_token']` lẫn `ExtractJwt.fromAuthHeaderAsBearerToken()`, giúp việc debug qua Swagger Docs (`http://localhost:8080/api/docs`) hoặc Postman/cURL vẫn hoạt động song song mà không làm gãy luồng Frontend.

---

## 4. Tài Liệu Kỹ Thuật Tham Khảo Chính Thống (Official References & Citations)

1. **NestJS Interceptors & Global Response Mapping:**  
   - [NestJS Official Documentation — Interceptors](https://docs.nestjs.com/interceptors)  
   - *Cơ sở áp dụng:* Sử dụng RxJS `map()` operator để chuẩn hóa toàn bộ luồng dữ liệu trả về theo chuẩn RESTful Envelope.
2. **NestJS Exception Filters:**  
   - [NestJS Official Documentation — Exception Filters](https://docs.nestjs.com/exception-filters)  
   - *Cơ sở áp dụng:* Tạo `AllExceptionsFilter` bắt toàn bộ lỗi từ HTTP layer và database layer để đảm bảo backend không bao giờ bị crash hoặc rò rỉ stack trace nhạy cảm ra ngoài client.
3. **OWASP Session Management & Cookie Security Cheat Sheet:**  
   - [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)  
   - [MDN Web Docs — Using HTTP Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)  
   - *Cơ sở áp dụng:* Triển khai đầy đủ thuộc tính `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=604800` (7 ngày) theo khuyến nghị bảo mật chuẩn OWASP.
4. **Passport-JWT Custom Cookie Extractor:**  
   - [Passport-JWT Documentation](https://www.passportjs.org/packages/passport-jwt/)  
   - [NestJS Official Authentication Guide](https://docs.nestjs.com/security/authentication)  
   - *Cơ sở áp dụng:* Viết custom extractor function kết hợp cả Cookie Parser và Header Extractor.
5. **Prisma ORM 7.x Database Configuration & Seeding:**  
   - [Prisma Official Documentation — Config Datasource](https://www.prisma.io/docs/orm/prisma-schema/overview/prisma-config)  
   - *Cơ sở áp dụng:* Tách biệt `DATABASE_URL` trong `prisma.config.ts` để tối ưu cho kiến trúc Neon Serverless PostgreSQL connection pooling.
