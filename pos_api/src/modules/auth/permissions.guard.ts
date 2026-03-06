import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "./permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;

    // Keep ADMIN unrestricted while still allowing fine-grained permission assignment to other roles.
    if (user.role === "ADMIN") return true;

    const userPermissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];
    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
    if (!hasAllPermissions) {
      throw new ForbiddenException("No tiene permisos para ejecutar esta acción.");
    }

    return true;
  }
}
