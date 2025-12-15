import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrService } from '@pr/pr.service';
import { TimeWarningService } from '@pr/time-warning.service';
import { DashboardController } from '@dashboard/dashboard.controller';
import { RawDataController } from '@raw-data/raw-data.controller';
import { RawDataService } from '@raw-data/raw-data.service';
import { GitHubService } from '@github/github.service';
import { GitHubGraphQLService } from '@github/github-graphql.service';
import { StorageService } from '@storage/storage.service';
import { WorkflowValidationService } from '@workflow/workflow-validation.service';
import { CommitService } from '@commit/commit.service';
import { TimelineService } from '@timeline/timeline.service';
import { BusinessDaysService } from '@utils/business-days.service';
import { ScraperService } from '@scraper/scraper.service';
import { FindyScraperService } from '@scraper/findy-scraper.service';
import { AuthModule } from '@auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 1000, // 1000 requests per hour
      },
    ]),
    AuthModule,
  ],
  controllers: [AppController, DashboardController, RawDataController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AppService,
    PrService,
    TimeWarningService,
    GitHubService,
    GitHubGraphQLService,
    StorageService,
    WorkflowValidationService,
    CommitService,
    TimelineService,
    BusinessDaysService,
    ScraperService,
    FindyScraperService,
    RawDataService,
  ],
})
export class AppModule {}
