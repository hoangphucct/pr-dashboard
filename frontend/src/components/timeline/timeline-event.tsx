'use client';

import {
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
  timelineItemClasses,
} from '@mui/lab';
import { Link, Box, Typography, Paper } from '@mui/material';
import {
  Code as CodeIcon,
  CheckCircle as CheckCircleIcon,
  Merge as MergeIcon,
  Warning as WarningIcon,
  Comment as CommentIcon,
  RateReview as ReviewIcon,
  OpenInNew as OpenIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { formatTimelineDate } from '@/lib/utils';
import type { TimelineItem as TimelineItemType } from '@/types';

interface TimelineEventProps {
  readonly item: TimelineItemType;
  readonly isLast: boolean;
}

function getEventIcon(type: string) {
  switch (type) {
    case 'commit':
      return <CodeIcon fontSize="small" />;
    case 'approved':
      return <CheckCircleIcon fontSize="small" />;
    case 'merged':
      return <MergeIcon fontSize="small" />;
    case 'force_pushed':
      return <WarningIcon fontSize="small" />;
    case 'commented':
    case 'comment':
      return <CommentIcon fontSize="small" />;
    case 'review_requested':
    case 'reviewed':
      return <ReviewIcon fontSize="small" />;
    case 'opened':
    case 'ready_for_review':
      return <OpenIcon fontSize="small" />;
    default:
      return <ScheduleIcon fontSize="small" />;
  }
}

function getEventColor(
  type: string,
): 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'grey' {
  switch (type) {
    case 'commit':
      return 'info';
    case 'approved':
      return 'success';
    case 'merged':
      return 'secondary';
    case 'force_pushed':
      return 'warning';
    case 'commented':
    case 'comment':
      return 'grey';
    case 'review_requested':
    case 'reviewed':
      return 'primary';
    case 'opened':
    case 'ready_for_review':
      return 'success';
    default:
      return 'grey';
  }
}

export function TimelineEvent({ item, isLast }: TimelineEventProps) {
  const indentLevel = item.indentLevel || 0;
  const eventColor = getEventColor(item.type);

  return (
    <TimelineItem
      sx={{
        ml: indentLevel > 0 ? `${indentLevel * 16}px` : 0,
        [`&.${timelineItemClasses.root}:before`]: {
          flex: 0,
          padding: 0,
        },
        minHeight: 'auto',
      }}
    >
      <TimelineOppositeContent
        sx={{
          flex: '0 0 140px',
          py: 1,
          px: 1,
          textAlign: 'right',
        }}
      >
        <Typography variant="caption" color="text.secondary" display="block">
          {formatTimelineDate(item.time)}
        </Typography>
        {item.actor && (
          <Typography variant="caption" color="text.secondary" display="block">
            {item.actor}
          </Typography>
        )}
      </TimelineOppositeContent>
      <TimelineSeparator>
        <TimelineDot color={eventColor}>{getEventIcon(item.type)}</TimelineDot>
        {!isLast && <TimelineConnector />}
      </TimelineSeparator>
      <TimelineContent sx={{ py: 1, px: 2, flex: 1 }}>
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            bgcolor: '#f8fafc',
            borderRadius: 2,
            border: '1px solid #e2e8f0',
            '&:hover': {
              bgcolor: '#f1f5f9',
              borderColor: '#cbd5e1',
            },
            transition: 'all 0.15s ease',
          }}
        >
          {item.url ? (
            <Link
              href={item.url}
              target="_blank"
              rel="noopener"
              sx={{
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#1e293b',
                textDecoration: 'none',
                '&:hover': { color: '#6366f1' },
              }}
            >
              {item.title || 'Event'}
            </Link>
          ) : (
            <Typography variant="body2" fontWeight={500} color="text.primary">
              {item.title || 'Event'}
            </Typography>
          )}
          {item.description && (
            <Box
              sx={{
                mt: 0.5,
                fontSize: '0.75rem',
                color: '#64748b',
                fontFamily: 'monospace',
                bgcolor: 'white',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                border: '1px solid #e2e8f0',
              }}
            >
              {item.description}
            </Box>
          )}
        </Paper>
      </TimelineContent>
    </TimelineItem>
  );
}
