import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DepartmentType, Role } from '@prisma/client';

@Injectable()
export class InventoryGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;

    if (!user) {
      throw new ForbiddenException('Yêu cầu xác thực người dùng.');
    }

    const activeTenure = user.tenures?.find(
      (t: any) => t.tenure && !t.tenure.isFrozen,
    ) || user.tenures?.[0];

    if (!activeTenure) {
      throw new ForbiddenException('Không tìm thấy nhiệm kỳ hoạt động hợp lệ.');
    }

    // LEAD has full access
    if (activeTenure.role === Role.LEAD) {
      return true;
    }

    // DELETE requires LEAD
    if (method === 'DELETE') {
      throw new ForbiddenException(
        'Chỉ Ban Chủ Nhiệm (LEAD) mới có quyền xóa vật tư khỏi kho.',
      );
    }

    const isHrEvent = activeTenure.department?.code === DepartmentType.HR_EVENT;

    // POST / PUT requires LEAD or HR_EVENT Department Lead
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      if (isHrEvent && activeTenure.role === Role.DEPARTMENT_LEAD) {
        return true;
      }
      throw new ForbiddenException(
        'Chỉ Ban Chủ Nhiệm hoặc Trưởng Ban HR-Event mới có quyền thêm/sửa vật tư.',
      );
    }

    // GET allows LEAD, ADVISOR, and all HR_EVENT members
    if (method === 'GET') {
      if (activeTenure.role === Role.ADVISOR || isHrEvent) {
        return true;
      }
    }

    throw new ForbiddenException(
      'Bạn không có quyền truy cập vào phân hệ Quản lý Kho Vật tư.',
    );
  }
}
