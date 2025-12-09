import { Box, CircularProgress, Paper, Typography, Alert, Button } from '@mui/material';
import { Icon } from '@iconify/react';
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getOIDCPendingAuth,
  clearOIDCPendingAuth,
  completeOIDCAuth,
} from '../../lib/nomad/api/oidc';
import { saveClusterToken } from '../../lib/clusterStorage';

type CallbackStatus = 'processing' | 'success' | 'error';

interface CallbackState {
  status: CallbackStatus;
  message: string;
  error?: string;
}

/**
 * OIDC Callback Handler
 * 
 * This component handles the redirect from the OIDC provider after authentication.
 * It extracts the code and state from the URL, completes the authentication with
 * Nomad, and stores the resulting token.
 * 
 * Routes:
 * - /oidc/callback - Our primary callback URL
 * - /ui/settings/tokens - Standard Nomad callback URL (for compatibility)
 */
export default function OIDCCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<CallbackState>({
    status: 'processing',
    message: 'Completing authentication...',
  });
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in React strict mode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const completeAuth = async () => {
      // Get parameters from URL
      const code = searchParams.get('code');
      const urlState = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Check for OIDC provider errors
      if (error) {
        setState({
          status: 'error',
          message: 'Authentication failed',
          error: errorDescription || error,
        });
        return;
      }

      // Validate required parameters
      if (!code || !urlState) {
        setState({
          status: 'error',
          message: 'Invalid callback',
          error: 'Missing required parameters (code or state)',
        });
        return;
      }

      // Get pending auth info from sessionStorage
      const pendingAuth = getOIDCPendingAuth();
      if (!pendingAuth) {
        setState({
          status: 'error',
          message: 'Session expired',
          error: 'No pending authentication found. Please try again.',
        });
        return;
      }

      const { cluster, authMethod, nonce, redirectUri, returnTo } = pendingAuth;

      try {
        // Complete the auth with Nomad
        const tokenResponse = await completeOIDCAuth(
          cluster,
          authMethod,
          nonce,
          urlState,
          code,
          redirectUri
        );

        // Clear pending auth
        clearOIDCPendingAuth();

        // Now we need to use this token to log in
        // Call our backend login endpoint to set the HTTPOnly cookie
        const loginResponse = await fetch(
          `/api/clusters/${encodeURIComponent(cluster)}/v1/auth/login`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenResponse.secret_id }),
            credentials: 'include',
          }
        );

        if (!loginResponse.ok) {
          const errBody = await loginResponse.json().catch(() => ({}));
          throw new Error(errBody.error || 'Failed to complete login');
        }

        // Mark the cluster as authenticated in localStorage
        // The actual token is stored as HTTPOnly cookie by the backend
        saveClusterToken(cluster, true);

        setState({
          status: 'success',
          message: 'Authentication successful!',
        });

        // If this is a popup, try to communicate with the opener
        if (window.opener && !window.opener.closed) {
          // Post message to opener window
          window.opener.postMessage(
            {
              type: 'oidc-callback-success',
              cluster,
              tokenInfo: {
                name: tokenResponse.name,
                type: tokenResponse.type,
                policies: tokenResponse.policies,
                expiry_time: tokenResponse.expiry_time,
              },
            },
            window.location.origin
          );

          // Close the popup after a brief delay
          setTimeout(() => {
            window.close();
          }, 1500);
        } else {
          // Not a popup, redirect to the return URL or cluster home
          setTimeout(() => {
            navigate(returnTo || `/c/${cluster}`);
          }, 1500);
        }
      } catch (err) {
        console.error('OIDC auth completion error:', err);
        clearOIDCPendingAuth();
        setState({
          status: 'error',
          message: 'Authentication failed',
          error: err instanceof Error ? err.message : 'Unknown error occurred',
        });
      }
    };

    completeAuth();
  }, [searchParams, navigate]);

  const handleRetry = () => {
    clearOIDCPendingAuth();
    // If in popup, close it
    if (window.opener && !window.opener.closed) {
      window.close();
    } else {
      navigate('/clusters');
    }
  };

  const handleClose = () => {
    if (window.opener && !window.opener.closed) {
      window.close();
    } else {
      navigate('/clusters');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme =>
          theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        p: 2,
      }}
    >
      <Paper
        elevation={8}
        sx={{
          p: 4,
          maxWidth: 400,
          width: '100%',
          textAlign: 'center',
          borderRadius: 3,
        }}
      >
        {state.status === 'processing' && (
          <>
            <CircularProgress size={48} sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom>
              {state.message}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please wait while we complete the authentication...
            </Typography>
          </>
        )}

        {state.status === 'success' && (
          <>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: 'success.light',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 3,
              }}
            >
              <Icon icon="mdi:check" width={36} color="white" />
            </Box>
            <Typography variant="h6" gutterBottom color="success.main">
              {state.message}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {window.opener ? 'This window will close automatically...' : 'Redirecting...'}
            </Typography>
          </>
        )}

        {state.status === 'error' && (
          <>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: 'error.light',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 3,
              }}
            >
              <Icon icon="mdi:close" width={36} color="white" />
            </Box>
            <Typography variant="h6" gutterBottom color="error.main">
              {state.message}
            </Typography>
            {state.error && (
              <Alert severity="error" sx={{ mt: 2, mb: 3, textAlign: 'left' }}>
                {state.error}
              </Alert>
            )}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button variant="outlined" onClick={handleRetry}>
                Try Again
              </Button>
              <Button variant="contained" onClick={handleClose}>
                Close
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}

