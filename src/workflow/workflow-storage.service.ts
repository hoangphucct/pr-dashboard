import { Injectable } from '@nestjs/common';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { TimelineItem } from '@shared/timeline.types';

/**
 * WorkflowData now only contains timeline
 * All other data (prNumber, title, author, url, status, metrics, etc.) 
 * is stored in PrMetrics in data-{date}.json
 */
export interface WorkflowData {
  timeline: TimelineItem[];
  prUpdatedAt: string;
  timelineHash?: string; // Hash of timeline data to detect changes
}

interface WorkflowStorage {
  prNumber: number;
  workflow: WorkflowData;
  createdAt: string;
  updatedAt: string;
}

/**
 * Calculate hash of timeline data
 */
function calculateTimelineHash(timeline: TimelineItem[]): string {
  const timelineStr = JSON.stringify(timeline || []);
  return createHash('md5').update(timelineStr).digest('hex');
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
   * Save workflow data (timeline) for a PR
   */
  saveWorkflow(
    prNumber: number,
    workflow: WorkflowData,
  ): void {
    const filePath = this.getFilePath(prNumber);
    const existingData = this.loadWorkflow(prNumber);

    // Calculate hash if not provided
    if (!workflow.timelineHash) {
      workflow.timelineHash = calculateTimelineHash(workflow.timeline);
    }

    const storage: WorkflowStorage = {
      prNumber,
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

  /**
   * Get cached PR updatedAt from workflow storage
   */
  getCachedPrUpdatedAt(prNumber: number): string | null {
    const workflow = this.loadWorkflow(prNumber);
    return workflow?.workflow?.prUpdatedAt || null;
  }

  /**
   * Get cached timeline hash
   */
  getCachedTimelineHash(prNumber: number): string | null {
    const workflow = this.loadWorkflow(prNumber);
    return workflow?.workflow?.timelineHash || null;
  }

  /**
   * Check if timeline data has changed by comparing hash
   */
  checkTimelineDataChanged(prNumber: number): boolean {
    const workflow = this.loadWorkflow(prNumber);
    if (!workflow || !workflow.workflow.timeline) {
      return true; // No cache means needs update
    }

    const storedHash = workflow.workflow.timelineHash;
    if (!storedHash) {
      return true; // No hash means needs update
    }

    // Calculate current hash and compare
    const currentHash = calculateTimelineHash(workflow.workflow.timeline);
    return currentHash !== storedHash;
  }

  /**
   * Get timeline items from workflow
   */
  getTimelineItems(prNumber: number): TimelineItem[] {
    const workflow = this.loadWorkflow(prNumber);
    return workflow?.workflow?.timeline || [];
  }
}
