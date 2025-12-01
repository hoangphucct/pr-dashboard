import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'node:path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { HandlebarsHelper } from '@common/helpers/handlebars.helper';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const rootDir = process.cwd();
  app.setViewEngine('hbs');
  app.setBaseViewsDir(join(rootDir, 'views'));
  app.useStaticAssets(join(rootDir, 'public'), {
    prefix: '/',
  });

  // Register all Handlebars helpers
  HandlebarsHelper.registerHelpers();

  void app.listen(process.env.PORT ?? 3000);
  console.log(`Server is running on port ${process.env.PORT ?? 3000}`);
}
void bootstrap();
