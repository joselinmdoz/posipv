import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { LicenseService } from "./license.service";

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(private readonly licenseService: LicenseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true;
    const req = context.switchToHttp().getRequest();
    const method = String(req.method || "GET").toUpperCase();
    const path = this.normalizePath(String(req.path || req.url || "/"));

    if (this.isExemptPath(path, method)) {
      return true;
    }

    const status = await this.licenseService.getLicenseStatus();
    if (status.valid) return true;

    throw new ForbiddenException(status.message || "Licencia inválida.");
  }

  private normalizePath(path: string): string {
    const cleaned = path.split("?")[0] || "/";
    if (cleaned.startsWith("/api/")) return cleaned;
    if (cleaned === "/api") return "/api";
    return `/api${cleaned.startsWith("/") ? cleaned : `/${cleaned}`}`;
  }

  private isExemptPath(path: string, method: string): boolean {
    const clean = path.replace(/\/+$/, "") || "/";
    if (clean === "/api/health") return true;
    if (path.startsWith("/api/health/")) return true;
    if (clean === "/api/auth/login" && method === "POST") return true;
    if (clean.startsWith("/api/license")) return true;
    return false;
  }
}
