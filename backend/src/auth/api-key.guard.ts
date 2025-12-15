import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKeyHeader = request.headers['x-api-key'];
    const authHeader = request.headers.authorization;
    const apiKey =
      (typeof apiKeyHeader === 'string' ? apiKeyHeader : undefined) ||
      (typeof authHeader === 'string'
        ? authHeader.replace('Bearer ', '')
        : undefined);

    const validApiKey = this.configService.get<string>('API_KEY');
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'production';

    // In production, API_KEY is REQUIRED
    if (nodeEnv === 'production' && !validApiKey) {
      throw new UnauthorizedException(
        'API_KEY must be configured in production environment',
      );
    }
    // In development, only allow requests from localhost/frontend without API key
    if (!validApiKey && nodeEnv !== 'production') {
      const origin = request.headers.origin || '';
      const referer = request.headers.referer || '';
      const host = request.headers.host || '';

      const allowedHosts = ['localhost'];
      const isLocalRequest =
        allowedHosts.some(
          (h) =>
            host.includes(h) ||
            origin.includes(h) ||
            referer.includes(h),
        ) || !origin; // Allow requests with no origin (e.g., from same-origin)

      if (isLocalRequest) {
        // Development mode: allow local requests without API key
        // but log a warning
        console.warn(
          '[Security Warning] Request allowed without API key in development mode. ' +
            'Set API_KEY environment variable for production.',
        );
        return true;
      }

      throw new UnauthorizedException(
        'API key required for non-local requests',
      );
    }

    // If API_KEY is configured, always require it
    if (validApiKey) {
      if (!apiKey || apiKey !== validApiKey) {
        throw new UnauthorizedException('Invalid or missing API key');
      }
    }

    return true;
  }
}
