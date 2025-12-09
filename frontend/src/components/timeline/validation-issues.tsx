'use client';

import { cn } from '@/lib/utils';
import type { ValidationIssue } from '@/types';

interface ValidationIssuesProps {
  issues: ValidationIssue[];
}

export function ValidationIssues({ issues }: ValidationIssuesProps) {
  if (!issues || issues.length === 0) {
    return null;
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const containerClass = errorCount > 0 ? 'error' : 'warning';

  return (
    <div className={cn('validation-issues-container', containerClass)}>
      <div className="font-bold mb-3 text-gray-800 flex items-center gap-2">
        <span className="text-xl">⚠️</span>
        <span>
          Workflow Validation Issues ({errorCount} errors, {warningCount} warnings)
        </span>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-2">
        {issues.map((issue, index) => {
          const icon = issue.severity === 'error' ? '❌' : '⚠️';
          const typeText = issue.type.replace(/_/g, ' ').toUpperCase();

          return (
            <div
              key={index}
              className={cn(
                'p-3 bg-white/80 backdrop-blur-sm rounded-lg border-l-4 shadow-sm hover:shadow-md transition-shadow duration-200',
                issue.severity === 'error'
                  ? 'border-red-500 bg-gradient-to-r from-red-50/50 to-white'
                  : 'border-yellow-500 bg-gradient-to-r from-yellow-50/50 to-white',
              )}
            >
              <div
                className={cn(
                  'font-bold text-sm mb-1 flex items-center gap-2',
                  issue.severity === 'error' ? 'text-red-600' : 'text-yellow-700',
                )}
              >
                <span>{icon}</span>
                <span>{typeText}</span>
              </div>
              <div className="text-sm text-gray-800">{issue.message}</div>
              {issue.details && (
                <div className="text-xs text-gray-600 mt-1 italic bg-gray-50/50 px-2 py-1 rounded">
                  {JSON.stringify(issue.details)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
