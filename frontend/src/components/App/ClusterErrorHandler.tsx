import { Icon } from '@iconify/react';
import {
  Alert,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { getStoredClusters, removeCluster, saveCluster } from '../../lib/clusterStorage';
import { onClusterError, NomadError } from '../../lib/nomad/api/requests';
import { setConfig } from '../../redux/configSlice';

interface ClusterErrorState {
  cluster: string;
  message: string;
  errorType: 'auth' | 'not_found' | 'connection' | 'unknown';
  timestamp: number;
}

/**
 * ClusterErrorHandler - Handles cluster errors globally
 * - Shows a banner for auth errors with option to update token
 * - Redirects to error page for "not found" errors
 */
export default function ClusterErrorHandler() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [clusterError, setClusterError] = useState<ClusterErrorState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Track clusters we've already shown errors for to avoid repeated redirects
  // Using a ref to avoid re-subscription on every state update
  const notifiedClustersRef = useRef<Set<string>>(new Set());

  // Listen for cluster errors
  useEffect(() => {
    console.log('[ClusterErrorHandler] Setting up error listener');
    
    const unsubscribe = onClusterError((cluster: string, error: NomadError) => {
      const errorType = error.errorType || 'unknown';
      const notifiedClusters = notifiedClustersRef.current;
      
      console.log(`[ClusterErrorHandler] Received error for cluster "${cluster}":`, {
        errorType,
        message: error.message,
        status: error.status,
        currentPath: location.pathname,
        alreadyNotified: notifiedClusters.has(cluster),
      });

      // For "not_found" errors, redirect to the error page (but only once per cluster)
      if (errorType === 'not_found') {
        if (!notifiedClusters.has(cluster)) {
          notifiedClusters.add(cluster);
          console.log(`[ClusterErrorHandler] Redirecting to /clusters for not_found error`);
          // Redirect to home with error state (use replace to avoid back button loop)
          navigate('/clusters', {
            replace: true,
            state: {
              clusterError: {
                cluster,
                errorType: 'not_found',
                message: error.message
              }
            }
          });
        }
        return;
      }

      // For auth errors, redirect to login page
      if (errorType === 'auth') {
        // Don't redirect if we're already on the login page
        if (location.pathname.startsWith('/login/')) {
          console.log(`[ClusterErrorHandler] Already on login page, skipping redirect`);
          return;
        }

        // Only redirect once per cluster to avoid loops
        if (!notifiedClusters.has(cluster)) {
          notifiedClusters.add(cluster);
          console.log(`[ClusterErrorHandler] Redirecting to login for auth error`);
          // Redirect to login page with return URL
          navigate(`/login/${encodeURIComponent(cluster)}`, {
            state: {
              from: location.pathname + location.search,
              message: 'Your session has expired or the token is invalid. Please log in again.',
            }
          });
        }
        return;
      }

      // For connection errors (5xx, network failures, timeouts), redirect to home with error
      if (errorType === 'connection') {
        // Don't redirect if we're already on the home/clusters page
        if (location.pathname === '/clusters' || location.pathname === '/') {
          console.log(`[ClusterErrorHandler] Already on clusters page, skipping redirect`);
          return;
        }

        // Only redirect once per cluster to avoid loops
        if (!notifiedClusters.has(cluster)) {
          notifiedClusters.add(cluster);
          console.log(`[ClusterErrorHandler] Redirecting to /clusters for connection error`);
          // Redirect to home with connection error state
          navigate('/clusters', {
            replace: true,
            state: {
              clusterError: {
                cluster,
                errorType: 'connection_failed',
                message: error.message || 'Unable to connect to the cluster. The server may be unreachable or you may not be on the correct network (e.g., VPN).',
              }
            }
          });
        }
      }
    });

    return () => {
      console.log('[ClusterErrorHandler] Cleaning up error listener');
      unsubscribe();
    };
  }, [navigate, location.pathname, location.search]);

  // Clear notified clusters when navigating away from cluster context
  useEffect(() => {
    if (location.pathname === '/clusters' || location.pathname === '/') {
      notifiedClustersRef.current = new Set();
    }
  }, [location.pathname]);

  const handleDismiss = () => {
    setClusterError(null);
  };

  const handleOpenDialog = () => {
    setDialogOpen(true);
    setNewToken('');
    setUpdateError(null);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setNewToken('');
    setUpdateError(null);
  };

  const handleUpdateToken = async () => {
    if (!clusterError) return;

    setUpdating(true);
    setUpdateError(null);

    try {
      // Get the stored cluster config
      const storedClusters = getStoredClusters();
      const clusterConfig = storedClusters.find(c => c.name === clusterError.cluster);

      if (!clusterConfig) {
        setUpdateError('Cluster configuration not found. Please re-add the cluster from the home page.');
        return;
      }

      // Update the cluster with the new token
      const response = await fetch('/api/cluster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: clusterConfig.name,
          address: clusterConfig.address,
          region: clusterConfig.region || '',
          namespace: clusterConfig.namespace || '',
          token: newToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to update cluster');
      }

      // Update localStorage
      saveCluster({
        ...clusterConfig,
        token: newToken,
      });

      // Refresh config
      const configResponse = await fetch('/config');
      const config = await configResponse.json();

      const clustersToConfig: { [key: string]: any } = {};
      if (config?.clusters) {
        config.clusters.forEach((cluster: { name: string; server?: string }) => {
          clustersToConfig[cluster.name] = {
            name: cluster.name,
            server: cluster.server || '',
          };
        });
      }

      dispatch(setConfig({ clusters: clustersToConfig }));

      // Clear the error and close dialog
      setClusterError(null);
      handleCloseDialog();

      // Reload the page to refresh all data with new token
      window.location.reload();
    } catch (err) {
      setUpdateError((err as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveCluster = async () => {
    if (!clusterError) return;

    try {
      // Try to remove from backend
      await fetch(`/api/cluster/${encodeURIComponent(clusterError.cluster)}`, {
        method: 'DELETE',
      }).catch(() => {});

      // Remove from localStorage
      removeCluster(clusterError.cluster);

      // Refresh config
      const configResponse = await fetch('/config');
      const config = await configResponse.json();

      const clustersToConfig: { [key: string]: any } = {};
      if (config?.clusters) {
        config.clusters.forEach((cluster: { name: string; server?: string }) => {
          clustersToConfig[cluster.name] = {
            name: cluster.name,
            server: cluster.server || '',
          };
        });
      }

      dispatch(setConfig({ clusters: clustersToConfig }));

      setClusterError(null);
      handleCloseDialog();

      // Redirect to home
      navigate('/clusters');
    } catch (err) {
      setUpdateError((err as Error).message);
    }
  };

  const handleGoHome = () => {
    setClusterError(null);
    navigate('/clusters', { replace: true });
  };

  // Since auth errors now redirect to login, we only show the dialog for manual token updates
  // This component now mainly handles the "not_found" redirects via useEffect
  // Return null if no dialog-worthy error
  if (!clusterError) {
    return null;
  }

  return (
    <>
      <Collapse in={!!clusterError}>
        <Alert
          severity="warning"
          sx={{
            borderRadius: 0,
            '.MuiAlert-message': { flex: 1, display: 'flex', alignItems: 'center', gap: 2 },
          }}
          action={
            <IconButton size="small" color="inherit" onClick={handleDismiss}>
              <Icon icon="mdi:close" width={18} />
            </IconButton>
          }
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Authentication failed for cluster "{clusterError.cluster}"
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {clusterError.message}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={handleGoHome}
            >
              Go Home
            </Button>
            <Button
              size="small"
              variant="contained"
              color="warning"
              startIcon={<Icon icon="mdi:key" />}
              onClick={handleOpenDialog}
            >
              Update Token
            </Button>
          </Box>
        </Alert>
      </Collapse>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Icon icon="mdi:key" width={24} />
            Update Token for "{clusterError?.cluster}"
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Your ACL token may have expired or been revoked. Enter a new valid token to
              re-authenticate with this Nomad cluster.
            </Typography>

            {updateError && (
              <Alert severity="error" sx={{ py: 0.5 }}>
                {updateError}
              </Alert>
            )}

            <TextField
              label="New ACL Token"
              value={newToken}
              onChange={e => setNewToken(e.target.value)}
              placeholder="Enter your Nomad ACL token"
              fullWidth
              type="password"
              autoFocus
              helperText="The token will be stored locally and sent with requests to this cluster"
            />

            <Typography variant="caption" color="text.secondary">
              You can generate a new token using the Nomad CLI:{' '}
              <code>nomad acl token self</code> or obtain one from your administrator.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Button color="error" onClick={handleRemoveCluster} startIcon={<Icon icon="mdi:delete" />}>
            Remove Cluster
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              onClick={handleUpdateToken}
              variant="contained"
              disabled={!newToken.trim() || updating}
              startIcon={updating ? <Icon icon="mdi:loading" className="spin" /> : <Icon icon="mdi:check" />}
            >
              {updating ? 'Updating...' : 'Update Token'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
}
