# GDGoC-OS Backend

NestJS + PostgreSQL/Prisma. Xem ../../README.md và ../../PRODUCTION_AUDIT.md.

Cấu hình .env theo .env.example, rồi npm ci, npm run prisma:generate và npm run build.

Local: npm run start:dev. Production: NODE_ENV=production và npm run start:prod. PORT mặc định 8080, API /api, tài liệu API /api/docs.

JWT_SECRET và DATABASE_URL bắt buộc. Production JWT_SECRET phải có ít nhất 32 ký tự. CORS_ORIGINS là danh sách origin phân cách dấu phẩy. Webhook onboarding yêu cầu secret được cấu hình và header khớp.

Không còn seed ghi đè DB hoặc endpoint switch-user. db:migrate chỉ chạy sau khi xử lý baseline đúng với tình trạng DB. Build/generate cần dev tooling; runtime có thể prune --omit=dev --omit=optional --ignore-scripts sau khi generate/build.
