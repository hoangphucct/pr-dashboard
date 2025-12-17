'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Box, Stack } from '@mui/material';
import { useRawData, useDeleteRawDataFile } from '@/hooks/use-raw-data';
import { RawDataForm } from '@/components/raw-data/raw-data-form';
import { FileSelector } from '@/components/raw-data/file-selector';
import { RawDataHeader } from '@/components/raw-data/raw-data-header';
import { RawDataBackLink } from '@/components/raw-data/raw-data-back-link';
import { FileInfoCard } from '@/components/raw-data/file-info-card';
import { RawDataContent } from '@/components/raw-data/raw-data-content';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ErrorAlert } from '@/components/ui/error-alert';
import { EmptyState } from '@/components/ui/empty-state';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';

function RawDataPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedFile = searchParams.get('selectedFile') || undefined;
  const pageParam = searchParams.get('page');
  const currentPage = pageParam ? Number.parseInt(pageParam, 10) : 1;
  const validPage = Number.isNaN(currentPage) || currentPage < 1 ? 1 : currentPage;
  const { data, isLoading, error } = useRawData(selectedFile, validPage, DEFAULT_PAGE_SIZE);
  const deleteRawDataFile = useDeleteRawDataFile();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleFileChange = (fileName: string) => {
    if (fileName) {
      router.push(`/raw-data?selectedFile=${encodeURIComponent(fileName)}&page=1`);
    } else {
      router.push('/raw-data?page=1');
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    await deleteRawDataFile.mutateAsync(fileName);
    // Navigate to raw-data without selectedFile after deletion
    router.push('/raw-data?page=1');
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams();
    if (selectedFile) params.append('selectedFile', selectedFile);
    params.append('page', String(page));
    router.push(`/raw-data?${params.toString()}`);
  };

  if (!mounted) {
    return null;
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorAlert message={error.message} />;
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', py: 4, px: { xs: 2, md: 4 } }}>
      <RawDataHeader />
      <RawDataBackLink />

      <Stack spacing={3}>
        <RawDataForm />

        {data?.rawDataFiles && data.rawDataFiles.length > 0 && (
          <FileSelector
            files={data.rawDataFiles}
            selectedFile={selectedFile}
            onFileChange={handleFileChange}
            onDeleteFile={handleDeleteFile}
            isDeleting={deleteRawDataFile.isPending}
          />
        )}

        {data?.selectedFileData && <FileInfoCard fileInfo={data.selectedFileData} />}

        {data?.hasData && data.pagination && (
          <RawDataContent
            data={data.prsData}
            pagination={data.pagination}
            onPageChange={handlePageChange}
          />
        )}
        {!data?.hasData && selectedFile && (
          <EmptyState message="No PR data found in selected file." />
        )}
        {!data?.hasData && !selectedFile && data?.rawDataFiles && data.rawDataFiles.length > 0 && (
          <EmptyState message="Select a file from the dropdown above to view its data." />
        )}
      </Stack>
    </Box>
  );
}

export default function RawDataPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RawDataPageContent />
    </Suspense>
  );
}
