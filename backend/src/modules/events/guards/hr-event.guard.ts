import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DepartmentType, Role } from '@prisma/client';
import { canWork, currentMembership, isLevelOne } from '../../common/access';

@Injectable()
export class HrEventGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Yêu cầu xác thực người dùng.');
    }

    const activeTenure = currentMembership(user);

    if (!canWork(activeTenure) || activeTenure.tenure?.isFrozen || activeTenure.tenure?.isArchived) {
      throw new ForbiddenException('Không tìm thấy nhiệm kỳ hoạt động hợp lệ.');
    }

    // LEAD has full access across all operations
    if (isLevelOne(activeTenure.role)) {
      return true;
    }

    // Only the HR_EVENT department lead may manage events at level 2.
    const isHrEventMember =
      activeTenure.department?.code === DepartmentType.HR_EVENT &&
      activeTenure.role === Role.DEPARTMENT_LEAD;

    if (isHrEventMember) {
      return true;
    }

    throw new ForbiddenException(
      'Chỉ Ban Chủ Nhiệm hoặc Ban Nhân Sự & Sự Kiện (HR-Event) mới có quyền thực hiện thao tác này.',
    );
  }
}
