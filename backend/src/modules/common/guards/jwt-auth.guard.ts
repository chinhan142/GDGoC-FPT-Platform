import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { canWork, currentMembership } from '../access';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext): TUser {
    const result = super.handleRequest(err, user, info, context) as any;
    const request = context.switchToHttp().getRequest();
    const path = request.originalUrl.split('?')[0];
    if (result.mustChangePassword && !['/api/auth/me', '/api/auth/change-password', '/api/auth/logout'].includes(path)) {
      throw new ForbiddenException('Bạn cần đổi mật khẩu lần đầu trước khi sử dụng hệ thống.');
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)
      && !canWork(currentMembership(result))
      && !['/api/auth/change-password', '/api/auth/logout'].includes(path)
      && !/^\/api\/notifications\/(?:[^/]+\/read|read-all)$/.test(path)) {
      throw new ForbiddenException('Tài khoản Alumni hoặc tạm nghỉ chỉ có quyền xem.');
    }
    return result;
  }
}
