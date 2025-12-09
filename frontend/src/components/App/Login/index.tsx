import { Icon } from '@iconify/react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { login } from '../../../lib/auth';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { useTypedSelector } from '../../../redux/hooks';
import ClusterAvatar from '../../common/ClusterAvatar';

export default function Login() {
  const { cluster } = useParams<{ cluster: string }>();
  const navigate = useNavigate();
  
  const clusters = useTypedSelector(state => state.config.clusters) || {};

  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clusterInfo = cluster ? clusters[cluster] : undefined;
  const serverAddress = clusterInfo?.server || '';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Please enter a token');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(cluster || '', token.trim());
      // Redirect to cluster dashboard
      navigate(createRouteURL('nomadCluster', { cluster: cluster || '' }));
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to authenticate. Please check your token.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipAuth = () => {
    // For clusters without ACL, go directly to the dashboard
    navigate(createRouteURL('nomadCluster', { cluster: cluster || '' }));
  };

  const handleBackToHome = () => {
    navigate('/clusters');
  };

  if (!clusterInfo) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          p: 3,
        }}
      >
        <Icon icon="mdi:server-off" width={64} height={64} />
        <Typography variant="h5" sx={{ mt: 2, mb: 1 }}>
          Cluster not found
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          The cluster "{cluster}" does not exist.
        </Typography>
        <Button variant="contained" onClick={handleBackToHome}>
          Back to Home
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        p: 3,
      }}
    >
      <Card sx={{ maxWidth: 450, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          {/* Cluster Info Header */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <ClusterAvatar name={cluster || ''} size={64} />
            <Typography variant="h5" sx={{ mt: 2, fontWeight: 600 }}>
              {cluster || 'Unknown Cluster'}
            </Typography>
          </Box>

          {/* Server Address Display */}
          {serverAddress && (
            <Box
              sx={{
                mb: 3,
                p: 2,
                bgcolor: 'action.hover',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Icon icon="mdi:server" width={20} style={{ opacity: 0.7 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Nomad Address
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {serverAddress}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter your Nomad ACL token to access this cluster.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              fullWidth
              label="ACL Token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Enter your Nomad ACL token"
              autoFocus
              disabled={loading}
              sx={{ mb: 3 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowToken(!showToken)}
                      edge="end"
                      size="small"
                      disabled={loading}
                    >
                      <Icon icon={showToken ? 'mdi:eye-off' : 'mdi:eye'} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading || !token.trim()}
              sx={{ mb: 2 }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Sign In'
              )}
            </Button>

            {/* Skip option for non-ACL clusters */}
            <Divider sx={{ my: 2 }}>
              <Chip label="or" size="small" />
            </Divider>

            <Button
              variant="outlined"
              fullWidth
              size="large"
              onClick={handleSkipAuth}
              disabled={loading}
              startIcon={<Icon icon="mdi:arrow-right" />}
              sx={{ mb: 2 }}
            >
              Continue without token
            </Button>

            <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mb: 2 }}>
              Use this if your Nomad cluster does not have ACL enabled.
            </Typography>

            <Button variant="text" fullWidth onClick={handleBackToHome} disabled={loading}>
              Back to Clusters
            </Button>
          </form>

          {/* Help Text */}
          <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary">
              Need a token?{' '}
              <Link
                href="https://developer.hashicorp.com/nomad/tutorials/access-control/access-control-tokens"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn about Nomad ACL tokens
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
