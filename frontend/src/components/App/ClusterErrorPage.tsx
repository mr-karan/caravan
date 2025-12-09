import { Icon } from '@iconify/react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { getStoredClusters, removeCluster, saveCluster, StoredCluster } from '../../lib/clusterStorage';
import { setConfig } from '../../redux/configSlice';

export type ClusterErrorType = 'not_found' | 'auth_failed' | 'connection_failed' | 'unknown';

interface ClusterErrorPageProps {
  clusterName: string;
  errorType: ClusterErrorType;
  errorMessage?: string;
  onResolved?: () => void;
}

/**
 * ClusterErrorPage - Shown when there's an issue connecting to a cluster
 * Provides options to re-authenticate, re-add, or remove the cluster
 */
export default function ClusterErrorPage({
  clusterName,
  errorType,
  errorMessage,
  onResolved,
}: ClusterErrorPageProps) {
  const theme = useTheme();
  const dispatch = useDispatch();

  const [showReconnect, setShowReconnect] = useState(false);
  const [address, setAddress] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get stored cluster info if available
  const storedCluster = getStoredClusters().find(c => c.name === clusterName);

  const handleGoHome = () => {
    // Clear the error state and navigate home
    onResolved?.();
  };

  const handleRemoveCluster = async () => {
    try {
      // Try to remove from backend (may fail if not registered)
      await fetch(`/api/cluster/${encodeURIComponent(clusterName)}`, {
        method: 'DELETE',
      }).catch(() => {});

      // Remove from localStorage
      removeCluster(clusterName);

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
      // Clear the error state
      onResolved?.();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleReconnect = async () => {
    if (!address.trim()) {
      setError('Nomad address is required');
      return;
    }

    // Validate URL
    try {
      new URL(address);
    } catch {
      setError('Invalid address format');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First add cluster to backend (without token - we'll validate separately)
      const response = await fetch('/api/cluster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: clusterName,
          address: address,
          region: storedCluster?.region || '',
          namespace: storedCluster?.namespace || '',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to connect to cluster');
      }

      // If token provided, validate it via login endpoint
      if (token.trim()) {
        const loginResponse = await fetch(
          `/api/clusters/${encodeURIComponent(clusterName)}/v1/auth/login`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token.trim() }),
            credentials: 'include',
          }
        );

        if (!loginResponse.ok) {
          const errorData = await loginResponse.json().catch(() => ({}));
          const errorMessage = errorData.error || 'Invalid token';
          throw new Error(`Token validation failed: ${errorMessage}`);
        }
      }

      // Save to localStorage (don't save token - it's in HTTPOnly cookie now)
      saveCluster({
        name: clusterName,
        address: address,
        region: storedCluster?.region,
        namespace: storedCluster?.namespace,
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

      // Navigate to the cluster (use replace to clear error state)
      // Using window.location for a full page refresh to ensure clean state
      window.location.href = `/c/${encodeURIComponent(clusterName)}`;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  const getErrorInfo = () => {
    switch (errorType) {
      case 'not_found':
        return {
          icon: 'mdi:server-off',
          title: 'Cluster Not Connected',
          description:
            'This cluster is not registered with the backend. This can happen if the server was restarted or the cluster was added from a different session.',
          color: theme.palette.warning.main,
        };
      case 'auth_failed':
        return {
          icon: 'mdi:key-alert',
          title: 'Authentication Failed',
          description:
            'Your ACL token may have expired or been revoked. Please provide a new valid token to reconnect.',
          color: theme.palette.error.main,
        };
      case 'connection_failed':
        return {
          icon: 'mdi:wifi-off',
          title: 'Connection Failed',
          description:
            'Unable to connect to the Nomad cluster. This could be because:\n• You\'re not connected to the required VPN\n• The cluster address has changed\n• The server is temporarily unavailable',
          color: theme.palette.warning.main,
        };
      default:
        return {
          icon: 'mdi:alert-circle',
          title: 'Cluster Error',
          description: errorMessage || 'An error occurred while connecting to this cluster.',
          color: theme.palette.error.main,
        };
    }
  };

  const errorInfo = getErrorInfo();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        p: 3,
      }}
    >
      <Card sx={{ maxWidth: 500, width: '100%' }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: `${errorInfo.color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
            }}
          >
            <Icon icon={errorInfo.icon} width={40} color={errorInfo.color} />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            {errorInfo.title}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Cluster: <strong>{clusterName}</strong>
          </Typography>

          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ mb: 3, maxWidth: 400, mx: 'auto', whiteSpace: 'pre-line', textAlign: 'left' }}
          >
            {errorInfo.description}
          </Typography>

          {errorMessage && (
            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {errorMessage}
              </Typography>
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
              {error}
            </Alert>
          )}

          {!showReconnect ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Icon icon="mdi:refresh" />}
                onClick={() => {
                  setShowReconnect(true);
                  setAddress(storedCluster?.address || '');
                }}
                fullWidth
              >
                Reconnect Cluster
              </Button>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<Icon icon="mdi:home" />}
                  onClick={handleGoHome}
                  fullWidth
                >
                  Go Home
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Icon icon="mdi:delete" />}
                  onClick={handleRemoveCluster}
                  fullWidth
                >
                  Remove
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'left' }}>
              <Divider sx={{ mb: 3 }} />

              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Reconnect to {clusterName}
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Nomad Address"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="http://localhost:4646"
                  fullWidth
                  size="small"
                  helperText="The HTTP address of the Nomad server"
                />

                <TextField
                  label="ACL Token (optional)"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Your Nomad ACL token"
                  type="password"
                  fullWidth
                  size="small"
                  helperText="Required if ACL is enabled on the cluster"
                />

                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={() => setShowReconnect(false)}
                    fullWidth
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleReconnect}
                    disabled={loading || !address.trim()}
                    startIcon={
                      loading ? (
                        <Icon icon="mdi:loading" className="spin" />
                      ) : (
                        <Icon icon="mdi:check" />
                      )
                    }
                    fullWidth
                  >
                    {loading ? 'Connecting...' : 'Connect'}
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {storedCluster && !showReconnect && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
          Last known address: {storedCluster.address}
        </Typography>
      )}
    </Box>
  );
}
