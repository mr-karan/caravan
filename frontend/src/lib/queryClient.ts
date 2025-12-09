import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3 * 60_000,
      gcTime: 10 * 60_000, // Garbage collect unused queries after 10 minutes
      refetchOnWindowFocus: false,
    },
  },
});
