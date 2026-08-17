import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDownload, type CreateDownloadPayload } from '../services/downloadService';

export function useCreateDownload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateDownloadPayload) => createDownload(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDownloads'] });
    },
  });
}