import { Icon } from '@iconify/react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { login } from '../../lib/nomad/api/auth';
import { saveClusterToken } from '../../lib/clusterStorage';
import { createRouteURL } from '../../lib/router/createRouteURL';

interface LocationState {
  from?: string;
  message?: string;
}

/**
 * Login page for authenticating to a Nomad cluster with an ACL token
 */
export default function Login() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { cluster } = useParams<{ cluster: string }>();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the return URL from location state, or default to cluster overview
  const returnUrl = state?.from || createRouteURL('nomadCluster', { cluster: cluster || '' });
  const message = state?.message;

  useEffect(() => {
    // Clear any previous error when the cluster changes
    setError(null);
    setToken('');
  }, [cluster]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token.trim()) {
      setError('Please enter your ACL token');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call login API to set the HTTPOnly cookie
      await login(token, cluster || '');

      // Also save a flag in localStorage to track that we have a token
      saveClusterToken(cluster || '', true);

      // Redirect back to where the user was or to cluster overview
      navigate(returnUrl, { replace: true });
    } catch (err) {
      const errorMessage = (err as Error).message;
      if (errorMessage.includes('403') || errorMessage.includes('401')) {
        setError('Invalid token. Please check your ACL token and try again.');
      } else {
        setError(errorMessage || 'Failed to authenticate. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleGoHome = () => {
    navigate('/clusters');
  };

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
      <Card sx={{ maxWidth: 440, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <Icon icon="mdi:key" width={32} color={theme.palette.primary.main} />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
              Authenticate
            </Typography>

            <Typography variant="body2" color="text.secondary">
              Enter your ACL token for <strong>{cluster}</strong>
            </Typography>
          </Box>

          {message && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              {message}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <TextField
              label="ACL Token"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              fullWidth
              type="password"
              autoFocus
              disabled={loading}
              sx={{ mb: 3 }}
              helperText="Your Nomad ACL token with appropriate permissions"
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading || !token.trim()}
              startIcon={
                loading ? (
                  <Icon icon="mdi:loading" className="spin" />
                ) : (
                  <Icon icon="mdi:login" />
                )
              }
              sx={{ mb: 2 }}
            >
              {loading ? 'Authenticating...' : 'Login'}
            </Button>

            <Button
              variant="text"
              fullWidth
              onClick={handleGoHome}
              disabled={loading}
              startIcon={<Icon icon="mdi:arrow-left" />}
            >
              Back to Clusters
            </Button>
          </form>
        </CardContent>
      </Card>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 3, textAlign: 'center', maxWidth: 400 }}
      >
        Your token is stored securely as an HTTPOnly cookie and is not accessible to JavaScript.
      </Typography>
    </Box>
  );
}
