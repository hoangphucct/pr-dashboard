import { Injectable } from '@nestjs/common';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';

export interface TimelineItem {
  type: string;
  title: string;
  time: string;
  actor?: string;
  url?: string;
}

export interface WorkflowData {
  prNumber: number;
  title: string;
  author: string;
  url: string;
  status: string;
  changedFiles?: number;
  additions?: number;
  deletions?: number;
  timeline: TimelineItem[];
  commitToOpen: number;
  openToReview: number;
  reviewToApproval: number;
  approvalToMerge: number;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowStorage {
  prNumber: number;
  workflow: WorkflowData;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class WorkflowStorageService {
  private readonly storageDir: string;

  constructor() {
    this.storageDir = join(process.cwd(), 'data', 'workflows');
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Get file path for a specific PR workflow
   */
  private getFilePath(prNumber: number): string {
    return join(this.storageDir, `workflow-${prNumber}.json`);
  }

  /**
   * Save workflow data for a PR
   */
  saveWorkflow(workflow: WorkflowData): void {
    const filePath = this.getFilePath(workflow.prNumber);
    const existingData = this.loadWorkflow(workflow.prNumber);

    const storage: WorkflowStorage = {
      prNumber: workflow.prNumber,
      workflow,
      createdAt: existingData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    writeFileSync(filePath, JSON.stringify(storage, null, 2), 'utf-8');
  }

  /**
   * Load workflow data for a PR
   */
  loadWorkflow(prNumber: number): WorkflowStorage | null {
    const filePath = this.getFilePath(prNumber);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as WorkflowStorage;
    } catch (error) {
      console.error(`Error loading workflow for PR ${prNumber}:`, error);
      return null;
    }
  }

  /**
   * List all workflows
   */
  listAllWorkflows(): WorkflowStorage[] {
    if (!existsSync(this.storageDir)) {
      return [];
    }

    const files = readdirSync(this.storageDir);
    const workflows: WorkflowStorage[] = [];

    for (const file of files) {
      if (file.startsWith('workflow-') && file.endsWith('.json')) {
        try {
          const prNumber = Number.parseInt(
            file.replace('workflow-', '').replace('.json', ''),
            10,
          );
          if (!Number.isNaN(prNumber)) {
            const workflow = this.loadWorkflow(prNumber);
            if (workflow) {
              workflows.push(workflow);
            }
          }
        } catch (error) {
          console.error(`Error loading workflow from file ${file}:`, error);
        }
      }
    }

    return workflows.sort((a, b) => b.prNumber - a.prNumber);
  }
}
