import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DepartmentType } from '@prisma/client';
import { canWork, currentMembership, isLevelOne } from '../../common/access';

@Injectable()
export class InventoryGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;

    if (!user) {
      throw new ForbiddenException('Yêu cầu xác thực người dùng.');
    }

    const activeTenure = currentMembership(user);

    if (!canWork(activeTenure) || activeTenure.tenure?.isFrozen || activeTenure.tenure?.isArchived) {
      throw new ForbiddenException('Không tìm thấy nhiệm kỳ hoạt động hợp lệ.');
    }

    // Level one roles have full access.
    if (isLevelOne(activeTenure.role)) {
      return true;
    }

    // Writes are restricted to level one roles.
    if (method === 'DELETE') {
      throw new ForbiddenException(
        'Chỉ Lv1 (LEAD/ADVISOR/ADMIN) mới có quyền xóa vật tư khỏi kho.',
      );
    }

    const isHrEvent = activeTenure.department?.code === DepartmentType.HR_EVENT;

    // HR_EVENT keeps read access only.
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      throw new ForbiddenException(
        'Chỉ Lv1 (LEAD/ADVISOR/ADMIN) mới có quyền thêm/sửa vật tư.',
      );
    }

    // GET allows active HR_EVENT members in addition to level one.
    if (method === 'GET') {
      if (isHrEvent) {
        return true;
      }
    }

    throw new ForbiddenException(
      'Bạn không có quyền truy cập vào phân hệ Quản lý Kho Vật tư.',
    );
  }
}
