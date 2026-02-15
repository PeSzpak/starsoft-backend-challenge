import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './auth.constants';
import { AppRole, AuthUser } from './auth.types';

type RequestWithUser = Request & { user?: AuthUser };

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const enabled =
      this.configService.get<string>('AUTH_ENABLED', 'true') === 'true';
    if (!enabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    const adminApiKey = this.configService.get<string>(
      'AUTH_ADMIN_API_KEY',
      'admin-secret',
    );
    const userApiKey = this.configService.get<string>(
      'AUTH_USER_API_KEY',
      'user-secret',
    );

    if (apiKey === adminApiKey) {
      request.user = {
        id: this.configService.get<string>('AUTH_ADMIN_USER_ID', 'admin-1'),
        role: AppRole.ADMIN,
      };
      return true;
    }

    if (apiKey === userApiKey) {
      request.user = {
        id: this.configService.get<string>('AUTH_DEFAULT_USER_ID', 'user-1'),
        role: AppRole.USER,
      };
      return true;
    }

    throw new UnauthorizedException('Invalid API key');
  }

  private extractApiKey(request: Request): string | null {
    const headerApiKey = request.headers['x-api-key'];
    if (typeof headerApiKey === 'string' && headerApiKey.length > 0) {
      return headerApiKey;
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && token) {
      return token;
    }

    return null;
  }
}

