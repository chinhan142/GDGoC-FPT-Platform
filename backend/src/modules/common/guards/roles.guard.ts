import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Observable } from 'rxjs';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { isLevelOne } from '../access';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    const activeTenure = user?.tenures?.find(
      // Tenure administrators must retain permission to unfreeze a tenure.
      // Workflow services/guards enforce freezing where operations require it.
      (t: any) => t.tenure && !t.tenure.isArchived && ['ACTIVE', 'PROBATION'].includes(t.status),
    );

    if (!activeTenure) {
      return false;
    }

    return requiredRoles.includes(activeTenure.role) || (requiredRoles.includes(Role.LEAD) && isLevelOne(activeTenure.role));
  }
}
