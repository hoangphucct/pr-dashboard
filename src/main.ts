import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'node:path';
import * as hbs from 'hbs';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  hbs.default.registerHelper('json', (context: unknown) => {
    // Simple JSON stringify helper
    // Use triple braces {{{json data}}} in template to prevent HTML escaping
    if (context === null || context === undefined) {
      return 'null';
    }

    // If it's an array, filter out null/undefined values
    if (Array.isArray(context)) {
      const filtered = context.filter(
        (item) =>
          item !== null &&
          item !== undefined &&
          typeof item === 'object' &&
          'prNumber' in item,
      );
      return JSON.stringify(filtered);
    }

    return JSON.stringify(context);
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  hbs.default.registerHelper('eq', (a: unknown, b: unknown) => a === b);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  hbs.default.registerHelper('length', (arr: unknown) => {
    return Array.isArray(arr) ? arr.length : 0;
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  hbs.default.registerHelper('gt', (a: unknown, b: unknown) => {
    return Number(a) > Number(b);
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  hbs.default.registerHelper('parseInt', (str: unknown, radix: unknown) => {
    const s = typeof str === 'string' ? str : '';
    const r = typeof radix === 'number' ? radix : 10;
    return Number.parseInt(s, r);
  });

  // Helper to determine text color based on background color brightness
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  hbs.default.registerHelper('labelTextColor', (color: unknown) => {
    const hexColor = typeof color === 'string' ? color : 'ffffff';
    const hex = hexColor.replace('#', '');
    const r = Number.parseInt(hex.substring(0, 2), 16);
    const g = Number.parseInt(hex.substring(2, 4), 16);
    const b = Number.parseInt(hex.substring(4, 6), 16);
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // Use white text for dark backgrounds, black for light backgrounds
    return luminance > 0.5 ? '#000' : '#fff';
  });

  // Helper to format time with business days
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  hbs.default.registerHelper('formatTimeWithDays', (hours: unknown) => {
    const h = Number.parseInt(hours as string, 10);
    if (h <= 0) {
      return '0h';
    }
    // 24 hours per business day
    const days = Math.round((h / 24) * 10) / 10;
    return `${h.toFixed(2)}h (${days}d)`;
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  hbs.default.registerHelper('or', (...args: unknown[]) => {
    const options = args[args.length - 1] as {
      fn?: () => unknown;
      inverse?: () => unknown;
    };
    if (options && options.fn) {
      for (let i = 0; i < args.length - 1; i++) {
        if (args[i]) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return options.fn.call(this);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return options.inverse ? options.inverse.call(this) : '';
    }
    return args.slice(0, -1).some((arg) => Boolean(arg));
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  hbs.default.registerHelper('add', (...args: number[]) => {
    const numbers = args.slice(0, -1);
    return numbers.reduce((sum, num) => sum + (num || 0), 0).toFixed(2);
  });

  void app.listen(process.env.PORT ?? 3000);
  console.log(`Server is running on port ${process.env.PORT ?? 3000}`);
}
void bootstrap();
