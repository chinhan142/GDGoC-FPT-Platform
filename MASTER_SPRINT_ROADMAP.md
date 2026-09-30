# 🗺️ GDGoC Platform — Kế Hoạch Sprints Tổng Thể (Master Sprint Roadmap)
**Dự án:** GDGoC FPTU HCMC Portal (Backend & Integration)  
**Vai trò:** Web Lead (Review & Testing) + AI Co-Pilot (Implementation)  
**Thời gian ước tính hoàn thành:** 1.5 – 2 ngày (Tổng cộng ~6 – 8 giờ làm việc tập trung qua các Block 50 phút)

---

## ⏱️ Đánh Giá Thời Gian Thực Hiện (Feasibility Assessment)

> [!IMPORTANT]
> - **1 – 2 tiếng:** ❌ **Không khả thi**. Nghiệp vụ phân quyền RBAC (5 roles, 7 ban), sổ cái Gems ACID chống gian lận (`idempotencyKey`), import Excel và phân hệ điểm danh khá lớn. Nếu làm vội trong 1-2 tiếng sẽ dễ sinh lỗi tiềm ẩn, thiếu test case và khó bảo trì khi scale.
> - **1 – 2 ngày (Mỗi ngày 3 – 4 block 50 phút):** ✅ **CỰC KỲ KHẢ THI & LÝ TƯỞNG**. Với mô hình "Tech Lead Review + AI Implementation", chúng ta vừa đảm bảo tốc độ nhanh, vừa code sạch, bảo mật 100% và test kỹ lưỡng từng phân hệ trước khi lên Production.

---

## 📊 Bảng Tiến Độ & Danh Sách 8 Sprints

| Sprint | Tên phân hệ (Module) | Mục tiêu nghiệp vụ trọng tâm | Trạng thái | Ước tính thời gian |
| :---: | :--- | :--- | :---: | :---: |
| **01** | **Core Foundation & Cookie Auth** | Nâng cấp Schema v1.1, Response Interceptors, HttpOnly Cookie Auth (`session_token`). | ✅ **HOÀN THÀNH** | 50 phút |
| **02** | **HR & Members Management** | Toàn bộ CRUD Member, Filter đa tầng, API Profile tự cập nhật, **Import Excel/CSV (`.xlsx`)**, Public Organizers cho Landing Page. | ✅ **HOÀN THÀNH** | 50 phút |
| **03** | **Events & Attendance Engine** | CRUD Event, Danh sách Attendees, Check-in thủ công tại bàn, Toggle check-in, phân quyền độc quyền cho `HR_EVENT` & `LEAD`. | ✅ **HOÀN THÀNH** | 50 phút |
| **04** | **Tasks Kanban & Workflow Sync** | Đồng bộ Kanban 5 cột với FE, nộp bài (submissionUrl), duyệt task và **tự động trigger cấp Gems** khi chuyển `DONE`. | ✅ **HOÀN THÀNH** | 50 phút |
| **05** | **Gems Ledger & Gift Shop** | Sổ cái giao dịch `GemsTransaction` chuẩn ACID với `idempotencyKey`, tính toán Leaderboard, lịch sử giao dịch, Đổi quà tặng & duyệt đơn. | ✅ **HOÀN THÀNH** | 50 phút |
| **06** | **Inventory & Notifications** | Quản lý kho vật tư / tài sản (`InventoryItem`), Trung tâm thông báo (`Notification` broadcast hoặc gửi riêng theo ban, đánh dấu đã đọc). | ✅ **HOÀN THÀNH** | 50 phút |
| **07** | **Generation Config, Drive & CMS**| Cấu hình niên khóa / Chuyển giao kỳ (`/config/generation/transition`), Quản trị danh mục Drive Assets, Landing CMS stats. | ✅ **HOÀN THÀNH** | 50 phút |
| **08** | **Integration & End-to-End Test** | Tắt Mock MSW trên Frontend, cấu hình Vite Proxy trỏ về Backend thật, test thông luồng toàn hệ thống từ A -> Z. | ✅ **HOÀN THÀNH** | 50 phút |
| **10** | **Frontend-Backend Contract Alignment** | Đồng bộ toàn bộ Frontend React với Backend DTOs & Enums (Tự suy khóa MSSV, Leaderboard rankings, EventType, AccessLevel, Sanitize Profile). | ✅ **HOÀN THÀNH** | 50 phút |

---

## 🔍 Chi Tiết Nội Dung SPRINT 02 (Sprint Tiếp Theo)

### 📌 Mục tiêu Sprint 02:
Xây dựng hoàn chỉnh module **Quản lý Nhân sự & Thành viên (`MembersModule`)** để phục vụ màn hình `/app/hr`, `/app/profile` và danh sách Core Team trên Landing Page.

### 📋 Các Endpoint & Nghiệp Vụ Cần Xây Dựng:
1. `GET /api/members`: Lấy danh sách thành viên có bộ lọc (`tenureId`, `departmentCode`, `status`, `search`, phân trang `page`, `limit`).
2. `POST /api/members`: Thêm mới thành viên vào nhiệm kỳ hiện tại (Chỉ `LEAD`).
3. `PUT /api/members/:id`: BCN cập nhật thông tin thành viên (role, ban, chức danh).
4. `DELETE /api/members/:id`: Soft delete thành viên (chuyển trạng thái sang `ALUMNI`).
5. `POST /api/members/import`: **Bóc tách file Excel (`.xlsx` / CSV)** được upload qua `multipart/form-data`, tự động tạo UserTenure hàng loạt và báo cáo dòng bị lỗi.
6. `PUT /api/members/:id/profile`: Cho phép từng thành viên tự cập nhật bio, kỹ năng (`skills`), avatar và link mạng xã hội của chính mình.
7. `GET /api/members/organizers`: Endpoint public (không cần login) trả về danh sách ban điều hành hiển thị ra trang chủ.

---

## 📜 Cam Kết Tuân Thủ Bộ Quy Tắc (Rules Compliance)
Mỗi Sprint tiếp theo sẽ tuân thủ nghiêm ngặt 3 tài liệu tại `D:\GDG-Management-Internal Docs\`:
1. `Implementation_Plan_Sprint_xx.md` (Kèm cam kết bảo mật 100%, không hardcode biến môi trường).
2. `Walkthrough_Sprint_xx.md` (Giải thích chi tiết luồng nghiệp vụ + tài liệu tham khảo chính thống).
3. `Review_Guide_Sprint_xx.md` (Hướng dẫn Lead review từng file và checklist test).
