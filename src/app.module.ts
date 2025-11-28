import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrService } from './pr/pr.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { GitHubService } from './github/github.service';
import { StorageService } from './storage/storage.service';
import { WorkflowStorageService } from './workflow/workflow-storage.service';
import { WorkflowValidationService } from './workflow/workflow-validation.service';
import { CommitService } from './commit/commit.service';
import { TimelineService } from './timeline/timeline.service';
import { BusinessDaysService } from './utils/business-days.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController, DashboardController],
  providers: [
    AppService,
    PrService,
    GitHubService,
    StorageService,
    WorkflowStorageService,
    WorkflowValidationService,
    CommitService,
    TimelineService,
    BusinessDaysService,
  ],
})
export class AppModule {}
