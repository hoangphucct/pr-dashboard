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
  hbs.default.registerHelper('json', (context: unknown, field?: string) => {
    if (field) {
      if (Array.isArray(context)) {
        return JSON.stringify(
          context.map((item) => (item as Record<string, unknown>)[field]),
        );
      }
      return JSON.stringify([]);
    }
    return JSON.stringify(context);
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  hbs.default.registerHelper('eq', (a: unknown, b: unknown) => a === b);

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
(async () => await bootstrap())();
