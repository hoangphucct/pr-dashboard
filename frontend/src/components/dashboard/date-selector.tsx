'use client';

import { useState, useEffect } from 'react';
import { Select, MenuItem, FormControl, InputLabel, Box } from '@mui/material';

interface DateSelectorProps {
  readonly availableDates: string[];
  readonly selectedDate: string;
  readonly onDateChange: (date: string) => void;
}

export function DateSelector({ availableDates, selectedDate, onDateChange }: DateSelectorProps) {
  const [today, setToday] = useState<string>('');

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

  return (
    <Box sx={{ maxWidth: 320 }}>
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
    </Box>
  );
}
