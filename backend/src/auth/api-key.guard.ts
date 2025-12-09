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

    if (!validApiKey) {
      // If no API_KEY is set, allow access (for development)
      return true;
    }

    if (!apiKey || apiKey !== validApiKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}
