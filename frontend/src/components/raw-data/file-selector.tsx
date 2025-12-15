'use client';

import { useState } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
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
import { Folder as FolderIcon } from '@mui/icons-material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { formatDate } from '@/lib/utils';
import type { RawDataFile } from '@/types';

interface FileSelectorProps {
  readonly files: RawDataFile[];
  readonly selectedFile?: string;
  readonly onFileChange: (fileName: string) => void;
  readonly onDeleteFile?: (fileName: string) => Promise<void>;
  readonly isDeleting?: boolean;
}

export function FileSelector({
  files,
  selectedFile,
  onFileChange,
  onDeleteFile,
  isDeleting = false,
}: FileSelectorProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!files || files.length === 0) {
    return null;
  }

  const handleDeleteClick = () => {
    if (selectedFile) {
      setConfirmOpen(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (onDeleteFile && selectedFile) {
      await onDeleteFile(selectedFile);
    }
    setConfirmOpen(false);
  };

  const handleCancelDelete = () => {
    setConfirmOpen(false);
  };

  // Get selected file info for display in dialog
  const selectedFileInfo = files.find((f) => f.fileName === selectedFile);

  return (
    <>
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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

          {onDeleteFile && selectedFile && (
            <Tooltip title={`Delete file: ${selectedFile}`}>
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
      </Box>

      <Dialog
        open={confirmOpen}
        onClose={handleCancelDelete}
        aria-labelledby="delete-file-dialog-title"
        aria-describedby="delete-file-dialog-description"
      >
        <DialogTitle id="delete-file-dialog-title" sx={{ color: '#dc2626' }}>
          Delete Raw Data File?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-file-dialog-description">
            This will permanently delete the file <strong>{selectedFile}</strong>
            {selectedFileInfo && (
              <>
                <br />
                <br />
                <Typography component="span" variant="body2" sx={{ color: '#64748b' }}>
                  Scraped at: {formatDate(selectedFileInfo.scrapedAt)}
                  <br />
                  Contains: {selectedFileInfo.prCount} PRs
                </Typography>
              </>
            )}
            <br />
            <br />
            This action cannot be undone.
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
