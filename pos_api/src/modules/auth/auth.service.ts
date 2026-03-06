import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { UsersService } from "../users/users.service";

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException("Credenciales inválidas.");
    if (!user.active) throw new UnauthorizedException("Usuario inactivo.");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Credenciales inválidas.");

    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    const access_token = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      email: user.email,
      permissions,
    });

    return {
      access_token,
      user: { id: user.id, email: user.email, role: user.role, permissions },
    };
  }
}
