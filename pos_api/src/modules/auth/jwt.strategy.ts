import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService) {
    const secret = cfg.get<string>("JWT_SECRET");
    if (!secret) {
      throw new Error("JWT_SECRET no está definido en .env");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  validate(payload: any) {
    return {
      userId: payload.sub,
      role: payload.role,
      email: payload.email,
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    };
  }
}
