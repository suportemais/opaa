import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { RbacService } from '../rbac/rbac.service';
import type { AuthUser } from './auth.types';

type JwtPayload = {
  sub: string;
  tid: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
    private readonly rbac: RbacService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findById(payload.sub);
    if (!user || user.status !== 'active' || user.tenantId !== payload.tid) {
      throw new UnauthorizedException();
    }

    const permissionCodes = this.rbac.getUserPermissionCodes(user);
    const unitIds = user.unitAccess.map((u) => u.unitId);

    return {
      userId: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      permissionCodes,
      unitIds,
    };
  }
}
