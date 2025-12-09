import { Controller, Get, Res } from '@nestjs/common';
import { AppService } from './app.service';
import type { Response } from 'express';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getIndex(@Res() res: Response) {
    try {
      const htmlPath = join(__dirname, '..', 'public', 'index.html');
      const html = readFileSync(htmlPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch {
      // Fallback if HTML file not found
      res.json({
        status: 'ok',
        message: 'PR Dashboard API is running',
        version: '1.0.0',
      });
    }
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      message: 'PR Dashboard API is running',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
