import { Icon } from '@iconify/react';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Select,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { login } from '../../../lib/auth';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { useTypedSelector } from '../../../redux/hooks';
import ClusterAvatar from '../../common/ClusterAvatar';
import {
  listOIDCAuthMethods,
  startOIDCLogin,
  AuthMethod,
} from '../../../lib/nomad/api/oidc';

export default function Login() {
  const { cluster } = useParams<{ cluster: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  
  const clusters = useTypedSelector(state => state.config.clusters) || {};

  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // OIDC state
  const [oidcMethods, setOidcMethods] = useState<AuthMethod[]>([]);
  const [selectedOidcMethod, setSelectedOidcMethod] = useState('');
  const [loadingOidc, setLoadingOidc] = useState(true);
  const [oidcStatus, setOidcStatus] = useState<'idle' | 'waiting' | 'success' | 'error'>('idle');

  const clusterInfo = cluster ? clusters[cluster] : undefined;
  const serverAddress = clusterInfo?.server || '';

  // Fetch OIDC methods on mount
  const fetchOidcMethods = useCallback(async () => {
    if (!cluster) return;
    setLoadingOidc(true);
    try {
      const methods = await listOIDCAuthMethods(cluster);
      setOidcMethods(methods);
      if (methods.length > 0) {
        // Select default method or first one
        const defaultMethod = methods.find(m => m.default) || methods[0];
        setSelectedOidcMethod(defaultMethod.name);
      }
    } catch (err) {
      console.warn('Failed to fetch OIDC methods:', err);
      setOidcMethods([]);
    }
    setLoadingOidc(false);
  }, [cluster]);

  useEffect(() => {
    fetchOidcMethods();
  }, [fetchOidcMethods]);

  // Listen for OIDC callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'oidc-callback-success' && event.data.cluster === cluster) {
        setOidcStatus('success');
        // Redirect to cluster dashboard after a brief delay
        setTimeout(() => {
          navigate(createRouteURL('nomadCluster', { cluster: cluster || '' }));
        }, 1000);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [cluster, navigate]);

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

  const handleOidcLogin = async () => {
    if (!selectedOidcMethod || !cluster) {
      setError('Please select an authentication method');
      return;
    }

    setOidcStatus('waiting');
    setError(null);

    try {
      const popup = await startOIDCLogin(cluster, selectedOidcMethod);
      if (!popup) {
        setError('Failed to open login window. Please allow popups for this site.');
        setOidcStatus('error');
        return;
      }

      // Poll for popup close (user might cancel)
      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          if (oidcStatus === 'waiting') {
            // Popup closed without success message
            setOidcStatus('idle');
          }
        }
      }, 500);
    } catch (err) {
      setError((err as Error).message);
      setOidcStatus('error');
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

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* OIDC Login Section */}
          {oidcMethods.length > 0 && (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Sign in with your organization's SSO provider.
                </Typography>

                {oidcMethods.length > 1 && (
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Authentication Method</InputLabel>
                    <Select
                      value={selectedOidcMethod}
                      label="Authentication Method"
                      onChange={e => setSelectedOidcMethod(e.target.value)}
                    >
                      {oidcMethods.map(method => (
                        <MenuItem key={method.name} value={method.name}>
                          {method.name}
                          {method.default && (
                            <Chip size="small" label="default" sx={{ ml: 1, height: 18 }} />
                          )}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={handleOidcLogin}
                  disabled={oidcStatus === 'waiting' || loading}
                  startIcon={
                    oidcStatus === 'waiting' ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : oidcStatus === 'success' ? (
                      <Icon icon="mdi:check-circle" />
                    ) : (
                      <Icon icon="mdi:login" />
                    )
                  }
                  color={oidcStatus === 'success' ? 'success' : 'primary'}
                >
                  {oidcStatus === 'waiting'
                    ? 'Waiting for authentication...'
                    : oidcStatus === 'success'
                    ? 'Authenticated! Redirecting...'
                    : `Sign in with ${selectedOidcMethod || 'SSO'}`}
                </Button>

                {oidcStatus === 'waiting' && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Complete the authentication in the popup window.
                  </Alert>
                )}
              </Box>

              <Divider sx={{ my: 3 }}>
                <Chip label="or use token" size="small" />
              </Divider>
            </>
          )}

          {/* Token Login Form */}
          <form onSubmit={handleLogin}>
            {oidcMethods.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Enter your Nomad ACL token to access this cluster.
              </Typography>
            )}

            <TextField
              fullWidth
              label="ACL Token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Enter your Nomad ACL token"
              autoFocus={oidcMethods.length === 0}
              disabled={loading || oidcStatus === 'waiting'}
              sx={{ mb: 2 }}
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
              variant={oidcMethods.length > 0 ? 'outlined' : 'contained'}
              fullWidth
              size="large"
              disabled={loading || !token.trim() || oidcStatus === 'waiting'}
              sx={{ mb: 2 }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Sign In with Token'
              )}
            </Button>

            {/* Skip option for non-ACL clusters */}
            <Divider sx={{ my: 2 }}>
              <Chip label="or" size="small" />
            </Divider>

            <Button
              variant="text"
              fullWidth
              size="large"
              onClick={handleSkipAuth}
              disabled={loading || oidcStatus === 'waiting'}
              startIcon={<Icon icon="mdi:arrow-right" />}
              sx={{ mb: 2 }}
            >
              Continue without authentication
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
              Need help?{' '}
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
