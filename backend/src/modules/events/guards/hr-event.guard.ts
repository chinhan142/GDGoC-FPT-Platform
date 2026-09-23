import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DepartmentType, Role } from '@prisma/client';

@Injectable()
export class HrEventGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Yêu cầu xác thực người dùng.');
    }

    const activeTenure = user.tenures?.find(
      (t: any) => t.tenure && !t.tenure.isFrozen,
    );

    if (!activeTenure) {
      throw new ForbiddenException('Không tìm thấy nhiệm kỳ hoạt động hợp lệ.');
    }

    // LEAD has full access across all operations
    if (activeTenure.role === Role.LEAD) {
      return true;
    }

    // HR_EVENT Department Lead & Members have exclusive access to check-in and attendance operations
    const isHrEventMember =
      activeTenure.department?.code === DepartmentType.HR_EVENT &&
      (activeTenure.role === Role.DEPARTMENT_LEAD ||
        activeTenure.role === Role.MEMBER);

    if (isHrEventMember) {
      return true;
    }

    throw new ForbiddenException(
      'Chỉ Ban Chủ Nhiệm hoặc Ban Nhân Sự & Sự Kiện (HR-Event) mới có quyền thực hiện thao tác này.',
    );
  }
}
