'use client';

import { Select, MenuItem, FormControl, InputLabel, Box, Typography } from '@mui/material';
import { Folder as FolderIcon } from '@mui/icons-material';
import { formatDate } from '@/lib/utils';
import type { RawDataFile } from '@/types';

interface FileSelectorProps {
  readonly files: RawDataFile[];
  readonly selectedFile?: string;
  readonly onFileChange: (fileName: string) => void;
}

export function FileSelector({ files, selectedFile, onFileChange }: FileSelectorProps) {
  if (!files || files.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        bgcolor: 'white',
        p: 3,
        borderRadius: 3,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <FolderIcon sx={{ color: '#6366f1' }} />
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
          Available Data Files
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', ml: 1 }}>
          ({files.length} files)
        </Typography>
      </Box>
      <FormControl fullWidth size="small">
        <InputLabel>Select a file to view</InputLabel>
        <Select
          value={selectedFile || ''}
          onChange={(e) => onFileChange(e.target.value)}
          label="Select a file to view"
          sx={{
            bgcolor: '#f8fafc',
            borderRadius: 2,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#e5e7eb',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#6366f1',
            },
          }}
        >
          <MenuItem value="">
            <em>None selected</em>
          </MenuItem>
          {files.map((file) => (
            <MenuItem key={file.fileName} value={file.fileName}>
              {file.fileName} • {formatDate(file.scrapedAt)} • {file.prCount} PRs
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
