/**
 * Timeline related types
 */

export interface TimelineItem {
  type: string;
  title: string;
  time: string;
  actor?: string;
  url?: string;
  description?: string;
}

export interface TimelineResult {
  timeline: TimelineItem[];
}

export interface CommentWithType {
  id: number;
  created_at?: string;
  submitted_at?: string;
  body?: string;
  html_url?: string;
  user?: { login: string };
  commentType: 'review' | 'issue';
  timestamp: number;
}
