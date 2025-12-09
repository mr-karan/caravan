/**
 * Hook for cluster connection notifications and status tracking.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useSnackbar, VariantType } from 'notistack';

export interface ClusterStatus {
  connected: boolean;
  error?: string;
  errorType?: 'auth' | 'connection' | 'unknown';
  latencyMs?: number;
  lastChecked?: number;
}

interface UseClusterNotificationsOptions {
  /** Enable toast notifications for status changes */
  enableToasts?: boolean;
  /** Clusters to track */
  clusters: string[];
  /** Current cluster status map */
  statusMap: Record<string, ClusterStatus>;
}

/**
 * Hook to manage cluster connection notifications
 */
export function useClusterNotifications({
  enableToasts = true,
  clusters,
  statusMap,
}: UseClusterNotificationsOptions) {
  const { enqueueSnackbar } = useSnackbar();
  const prevStatusRef = useRef<Record<string, ClusterStatus>>({});
  const notifiedRef = useRef<Set<string>>(new Set());

  // Track status changes and show notifications
  useEffect(() => {
    if (!enableToasts) return;

    clusters.forEach(clusterName => {
      const currentStatus = statusMap[clusterName];
      const prevStatus = prevStatusRef.current[clusterName];

      if (!currentStatus) return;

      // Only notify on actual status changes, not initial load
      if (prevStatus !== undefined) {
        const statusKey = `${clusterName}-${currentStatus.connected}-${currentStatus.errorType}`;
        
        // Avoid duplicate notifications
        if (notifiedRef.current.has(statusKey)) return;

        // Status changed from connected to disconnected
        if (prevStatus.connected && !currentStatus.connected) {
          notifiedRef.current.add(statusKey);
          
          let message = `Lost connection to ${clusterName}`;
          let variant: VariantType = 'error';
          
          if (currentStatus.errorType === 'auth') {
            message = `${clusterName}: Authentication required`;
            variant = 'warning';
          }

          enqueueSnackbar(message, {
            variant,
            autoHideDuration: 5000,
            preventDuplicate: true,
          });

          // Clear the notification flag after some time
          setTimeout(() => {
            notifiedRef.current.delete(statusKey);
          }, 10000);
        }
        
        // Status changed from disconnected to connected
        if (!prevStatus.connected && currentStatus.connected) {
          notifiedRef.current.add(statusKey);
          
          enqueueSnackbar(`Connected to ${clusterName}`, {
            variant: 'success',
            autoHideDuration: 3000,
            preventDuplicate: true,
          });

          // Clear the notification flag after some time
          setTimeout(() => {
            notifiedRef.current.delete(statusKey);
          }, 10000);
        }
      }
    });

    // Update previous status reference
    prevStatusRef.current = { ...statusMap };
  }, [clusters, statusMap, enableToasts, enqueueSnackbar]);

  // Manual notification function
  const notifyClusterStatus = useCallback(
    (clusterName: string, status: 'connected' | 'disconnected' | 'error', message?: string) => {
      const variants: Record<string, VariantType> = {
        connected: 'success',
        disconnected: 'error',
        error: 'error',
      };

      const defaultMessages: Record<string, string> = {
        connected: `Connected to ${clusterName}`,
        disconnected: `Disconnected from ${clusterName}`,
        error: `Error connecting to ${clusterName}`,
      };

      enqueueSnackbar(message || defaultMessages[status], {
        variant: variants[status],
        autoHideDuration: status === 'connected' ? 3000 : 5000,
        preventDuplicate: true,
      });
    },
    [enqueueSnackbar]
  );

  // Notify on cluster switch
  const notifyClusterSwitch = useCallback(
    (fromCluster: string | null, toCluster: string) => {
      enqueueSnackbar(`Switched to ${toCluster}`, {
        variant: 'info',
        autoHideDuration: 2000,
        preventDuplicate: true,
      });
    },
    [enqueueSnackbar]
  );

  return {
    notifyClusterStatus,
    notifyClusterSwitch,
  };
}

export default useClusterNotifications;

