import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrService } from './pr/pr.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { GitHubService } from './github/github.service';
import { StorageService } from './storage/storage.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController, DashboardController],
  providers: [AppService, PrService, GitHubService, StorageService],
})
export class AppModule {}
