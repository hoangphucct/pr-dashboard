'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

interface DateSelectorProps {
  readonly availableDates: string[];
  readonly selectedDate: string;
  readonly onDateChange: (date: string) => void;
  readonly onDeleteDate?: (date: string) => Promise<void>;
  readonly isDeleting?: boolean;
}

export function DateSelector({
  availableDates,
  selectedDate,
  onDateChange,
  onDeleteDate,
  isDeleting = false,
}: DateSelectorProps) {
  const [today, setToday] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Use useEffect to get today's date on client side only to avoid hydration mismatch
  useEffect(() => {
    setToday(new Date().toISOString().split('T')[0]);
  }, []);

  if (!availableDates || availableDates.length === 0) {
    return null;
  }

  // Create unique list of dates: today first (if set), then available dates (excluding today if present)
  const uniqueDates = today
    ? [today, ...availableDates.filter((date) => date !== today)]
    : availableDates;

  const handleDeleteClick = () => {
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (onDeleteDate) {
      await onDeleteDate(selectedDate);
    }
    setConfirmOpen(false);
  };

  const handleCancelDelete = () => {
    setConfirmOpen(false);
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, maxWidth: 400 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Select date to view data</InputLabel>
          <Select
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            label="Select date to view data"
            sx={{
              bgcolor: 'white',
              borderRadius: 2,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#e5e7eb',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#6366f1',
              },
            }}
          >
            {uniqueDates.map((date) => (
              <MenuItem key={date} value={date}>
                {today && date === today ? `Today (${date})` : date}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {onDeleteDate && (
          <Tooltip title={`Delete all data for ${selectedDate}`}>
            <span>
              <IconButton
                onClick={handleDeleteClick}
                disabled={isDeleting}
                sx={{
                  color: '#ef4444',
                  bgcolor: 'white',
                  border: '1px solid #fecaca',
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: '#fef2f2',
                    borderColor: '#ef4444',
                  },
                  '&:disabled': {
                    bgcolor: '#f3f4f6',
                  },
                }}
              >
                {isDeleting ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <DeleteOutlineIcon />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>

      <Dialog
        open={confirmOpen}
        onClose={handleCancelDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title" sx={{ color: '#dc2626' }}>
          Delete Data for {selectedDate}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            This will permanently delete all PR data for <strong>{selectedDate}</strong>. This
            action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={handleCancelDelete} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
