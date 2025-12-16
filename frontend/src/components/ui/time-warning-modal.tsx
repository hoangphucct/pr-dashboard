'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  Divider,
  LinearProgress,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import type { TimeWarning } from '@/types';

interface TimeWarningModalProps {
  open: boolean;
  onClose: () => void;
  warnings: TimeWarning[];
  prNumber: number;
}

function getProgressColor(actual: number, limit: number): string {
  const ratio = actual / limit;
  if (ratio > 2) return '#dc2626'; // red
  if (ratio > 1.5) return '#f97316'; // orange
  return '#eab308'; // yellow
}

function formatHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours.toFixed(0)}h`;
}

export function TimeWarningModal({ open, onClose, warnings, prNumber }: TimeWarningModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          bgcolor: '#fef3c7',
          borderBottom: '1px solid #fcd34d',
          py: 2,
          px: 3,
        }}
      >
        <WarningAmberIcon sx={{ color: '#d97706', fontSize: 28 }} />
        <Typography variant="h6" component="span" sx={{ fontWeight: 600, color: '#92400e' }}>
          Cảnh Báo Vượt Ngưỡng Thời Gian
        </Typography>
        <Chip
          label={`PR #${prNumber}`}
          size="small"
          sx={{
            ml: 'auto',
            bgcolor: '#f59e0b',
            color: 'white',
            fontWeight: 600,
          }}
        />
      </DialogTitle>

      <DialogContent sx={{ pt: 0, pb: 2, bgcolor: '#fafafa' }}>
        <Typography variant="body2" sx={{ mt: 3, mb: 2.5, color: '#6b7280' }}>
          PR này đã vi phạm <strong style={{ color: '#dc2626' }}>{warnings.length}</strong> ngưỡng
          thời gian xử lý:
        </Typography>

        {warnings.map((warning) => (
          <Card
            key={warning.type}
            variant="outlined"
            sx={{
              mb: 2,
              bgcolor: '#ffffff',
              borderColor: '#e5e7eb',
              borderRadius: 2,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              '&:hover': {
                borderColor: '#f59e0b',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)',
              },
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              {/* Header with phase name and time info */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      bgcolor: '#fef2f2',
                      borderRadius: 1,
                      p: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AccessTimeIcon sx={{ fontSize: 20, color: '#dc2626' }} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#1f2937' }}>
                    {warning.label}
                  </Typography>
                </Box>
                <Chip
                  label={`+${formatHours(warning.actual - warning.limit)}`}
                  size="small"
                  sx={{
                    bgcolor: '#fef2f2',
                    color: '#dc2626',
                    fontWeight: 700,
                    border: '1px solid #fecaca',
                  }}
                />
              </Box>

              {/* Progress bar showing how much over limit */}
              <Box sx={{ mb: 2, bgcolor: '#f9fafb', borderRadius: 1.5, p: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 500 }}>
                    Thực tế:{' '}
                    <strong style={{ color: '#1f2937' }}>{formatHours(warning.actual)}</strong>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 500 }}>
                    Giới hạn:{' '}
                    <strong style={{ color: '#1f2937' }}>{formatHours(warning.limit)}</strong>
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min((warning.actual / warning.limit) * 100, 100)}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    bgcolor: '#e5e7eb',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: getProgressColor(warning.actual, warning.limit),
                      borderRadius: 5,
                    },
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mt: 0.75,
                    textAlign: 'right',
                    color: '#dc2626',
                    fontWeight: 600,
                  }}
                >
                  {((warning.actual / warning.limit) * 100).toFixed(0)}% của giới hạn
                </Typography>
              </Box>

              {/* Suggested reasons */}
              {warning.suggestedReasons && warning.suggestedReasons.length > 0 && (
                <>
                  <Divider sx={{ my: 1.5, borderColor: '#e5e7eb' }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                    <LightbulbIcon sx={{ fontSize: 18, color: '#f59e0b' }} />
                    <Typography variant="caption" fontWeight={600} sx={{ color: '#92400e' }}>
                      Lý do có thể:
                    </Typography>
                  </Box>
                  <List dense disablePadding>
                    {warning.suggestedReasons.map((reason, idx) => (
                      <ListItem key={idx} disableGutters sx={{ py: 0.25, pl: 1 }}>
                        <ListItemIcon sx={{ minWidth: 20 }}>
                          <Box
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor: '#9ca3af',
                            }}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={reason}
                          primaryTypographyProps={{
                            variant: 'body2',
                            sx: { color: '#4b5563' },
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#ffffff', borderTop: '1px solid #e5e7eb' }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            bgcolor: '#3b82f6',
            '&:hover': { bgcolor: '#2563eb' },
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
          }}
        >
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
