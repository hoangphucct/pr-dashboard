'use client';

import { Timeline, timelineItemClasses } from '@mui/lab';
import { CircularProgress, Box, Alert, Typography, Paper } from '@mui/material';
import { TimelineEvent } from './timeline-event';
import { ValidationIssues } from './validation-issues';
import type { TimelineItem, ValidationIssue } from '@/types';

interface TimelineViewProps {
  readonly timeline: TimelineItem[];
  readonly validationIssues: ValidationIssue[];
  readonly isLoading?: boolean;
  readonly error?: string | null;
}

export function TimelineView({ timeline, validationIssues, isLoading, error }: TimelineViewProps) {
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 5 }}>
        <CircularProgress size={40} sx={{ color: '#6366f1' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error: {error}
      </Alert>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 4,
          textAlign: 'center',
          bgcolor: '#f8fafc',
          borderRadius: 2,
        }}
      >
        <Typography color="text.secondary">No timeline data available</Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <ValidationIssues issues={validationIssues} />
      <Timeline
        sx={{
          p: 0,
          m: 0,
          [`& .${timelineItemClasses.root}:before`]: {
            flex: 0,
            padding: 0,
          },
        }}
      >
        {timeline.map((item, index) => (
          <TimelineEvent key={index} item={item} isLast={index === timeline.length - 1} />
        ))}
      </Timeline>
    </Box>
  );
}
