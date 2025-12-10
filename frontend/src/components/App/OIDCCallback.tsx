import { Box, Typography, Button, alpha } from '@mui/material';
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

// Animated hexagon background component
function HexagonBackground() {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity: 0.15,
        '& svg': {
          position: 'absolute',
          width: '100%',
          height: '100%',
        },
      }}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="hexagons" width="8" height="14" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
            <path
              d="M4 0L8 2V6L4 8L0 6V2L4 0Z M4 8L8 10V14L4 16L0 14V10L4 8Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.3"
              style={{ color: '#00d4ff' }}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hexagons)" />
      </svg>
    </Box>
  );
}

// Animated security ring for processing state
function SecurityRing({ status }: { status: CallbackStatus }) {
  const isProcessing = status === 'processing';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  return (
    <Box
      sx={{
        position: 'relative',
        width: 120,
        height: 120,
        mx: 'auto',
        mb: 4,
      }}
    >
      {/* Outer rotating ring */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '2px solid transparent',
          borderTopColor: isSuccess ? '#00ff88' : isError ? '#ff4466' : '#00d4ff',
          borderRightColor: isSuccess ? '#00ff88' : isError ? '#ff4466' : alpha('#00d4ff', 0.3),
          animation: isProcessing ? 'spin 1.5s linear infinite' : 'none',
          transition: 'border-color 0.5s ease',
          '@keyframes spin': {
            from: { transform: 'rotate(0deg)' },
            to: { transform: 'rotate(360deg)' },
          },
        }}
      />

      {/* Middle pulsing ring */}
      <Box
        sx={{
          position: 'absolute',
          inset: 8,
          borderRadius: '50%',
          border: '1px solid',
          borderColor: isSuccess ? alpha('#00ff88', 0.5) : isError ? alpha('#ff4466', 0.5) : alpha('#00d4ff', 0.3),
          animation: isProcessing ? 'pulse 2s ease-in-out infinite' : 'none',
          transition: 'border-color 0.5s ease',
          '@keyframes pulse': {
            '0%, 100%': { transform: 'scale(1)', opacity: 0.5 },
            '50%': { transform: 'scale(1.05)', opacity: 1 },
          },
        }}
      />

      {/* Inner glow circle */}
      <Box
        sx={{
          position: 'absolute',
          inset: 20,
          borderRadius: '50%',
          background: isSuccess 
            ? 'radial-gradient(circle, rgba(0, 255, 136, 0.2) 0%, transparent 70%)'
            : isError
            ? 'radial-gradient(circle, rgba(255, 68, 102, 0.2) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(0, 212, 255, 0.15) 0%, transparent 70%)',
          transition: 'background 0.5s ease',
        }}
      />

      {/* Center icon */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isProcessing && (
          <Icon 
            icon="mdi:shield-lock-outline" 
            width={40} 
            style={{ 
              color: '#00d4ff',
              animation: 'fadeInOut 2s ease-in-out infinite',
            }} 
          />
        )}
        {isSuccess && (
          <Box
            sx={{
              animation: 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              '@keyframes scaleIn': {
                from: { transform: 'scale(0)', opacity: 0 },
                to: { transform: 'scale(1)', opacity: 1 },
              },
            }}
          >
            <Icon icon="mdi:shield-check" width={44} style={{ color: '#00ff88' }} />
          </Box>
        )}
        {isError && (
          <Box
            sx={{
              animation: 'shake 0.5s ease-in-out',
              '@keyframes shake': {
                '0%, 100%': { transform: 'translateX(0)' },
                '20%, 60%': { transform: 'translateX(-4px)' },
                '40%, 80%': { transform: 'translateX(4px)' },
              },
            }}
          >
            <Icon icon="mdi:shield-off-outline" width={44} style={{ color: '#ff4466' }} />
          </Box>
        )}
      </Box>

      {/* Scanning line effect for processing */}
      {isProcessing && (
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: '10%',
            width: 2,
            height: '80%',
            background: 'linear-gradient(180deg, transparent, #00d4ff, transparent)',
            transform: 'translateX(-50%)',
            animation: 'scan 2s ease-in-out infinite',
            '@keyframes scan': {
              '0%': { opacity: 0, transform: 'translateX(-50%) rotate(0deg)' },
              '50%': { opacity: 1 },
              '100%': { opacity: 0, transform: 'translateX(-50%) rotate(360deg)' },
            },
          }}
        />
      )}
    </Box>
  );
}

// Data flow particles
function DataParticles({ active }: { active: boolean }) {
  if (!active) return null;
  
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {[...Array(6)].map((_, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            width: 4,
            height: 4,
            borderRadius: '50%',
            backgroundColor: '#00d4ff',
            left: `${20 + i * 12}%`,
            animation: `particle${i % 3} ${2 + i * 0.3}s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
            opacity: 0,
            '@keyframes particle0': {
              '0%, 100%': { top: '100%', opacity: 0 },
              '50%': { top: '40%', opacity: 0.8 },
            },
            '@keyframes particle1': {
              '0%, 100%': { top: '100%', opacity: 0 },
              '50%': { top: '30%', opacity: 0.6 },
            },
            '@keyframes particle2': {
              '0%, 100%': { top: '100%', opacity: 0 },
              '50%': { top: '50%', opacity: 0.7 },
            },
          }}
        />
      ))}
    </Box>
  );
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
    message: 'Verifying credentials...',
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
          message: 'Authentication Failed',
          error: errorDescription || error,
        });
        return;
      }

      // Validate required parameters
      if (!code || !urlState) {
        setState({
          status: 'error',
          message: 'Invalid Callback',
          error: 'Missing required parameters (code or state)',
        });
        return;
      }

      // Get pending auth info from sessionStorage
      const pendingAuth = getOIDCPendingAuth();
      if (!pendingAuth) {
        setState({
          status: 'error',
          message: 'Session Expired',
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
          message: 'Access Granted',
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
          }, 1800);
        } else {
          // Not a popup, redirect to the return URL or cluster home
          setTimeout(() => {
            navigate(returnTo || `/c/${encodeURIComponent(cluster)}`);
          }, 1800);
        }
      } catch (err) {
        console.error('OIDC auth completion error:', err);
        clearOIDCPendingAuth();
        setState({
          status: 'error',
          message: 'Authentication Failed',
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
        background: 'linear-gradient(135deg, #0a0e17 0%, #0d1321 50%, #0a0e17 100%)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", monospace',
      }}
    >
      {/* Animated background */}
      <HexagonBackground />
      
      {/* Floating particles during processing */}
      <DataParticles active={state.status === 'processing'} />

      {/* Gradient overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, transparent 0%, rgba(10, 14, 23, 0.8) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Main card */}
      <Box
        sx={{
          position: 'relative',
          maxWidth: 380,
          width: '100%',
          mx: 2,
          p: 4,
          background: alpha('#0d1321', 0.85),
          backdropFilter: 'blur(20px)',
          borderRadius: 3,
          border: '1px solid',
          borderColor: state.status === 'success' 
            ? alpha('#00ff88', 0.3)
            : state.status === 'error'
            ? alpha('#ff4466', 0.3)
            : alpha('#00d4ff', 0.2),
          boxShadow: state.status === 'success'
            ? `0 0 60px ${alpha('#00ff88', 0.15)}, inset 0 1px 0 ${alpha('#00ff88', 0.1)}`
            : state.status === 'error'
            ? `0 0 60px ${alpha('#ff4466', 0.15)}, inset 0 1px 0 ${alpha('#ff4466', 0.1)}`
            : `0 0 60px ${alpha('#00d4ff', 0.1)}, inset 0 1px 0 ${alpha('#00d4ff', 0.1)}`,
          transition: 'all 0.5s ease',
          animation: 'fadeIn 0.6s ease-out',
          '@keyframes fadeIn': {
            from: { opacity: 0, transform: 'translateY(20px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
        }}
      >
        {/* Top accent line */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: '10%',
            right: '10%',
            height: 2,
            background: state.status === 'success'
              ? 'linear-gradient(90deg, transparent, #00ff88, transparent)'
              : state.status === 'error'
              ? 'linear-gradient(90deg, transparent, #ff4466, transparent)'
              : 'linear-gradient(90deg, transparent, #00d4ff, transparent)',
            borderRadius: 1,
            transition: 'background 0.5s ease',
          }}
        />

        {/* Security ring animation */}
        <SecurityRing status={state.status} />

        {/* Status text */}
        <Typography
          sx={{
            fontSize: '1.5rem',
            fontWeight: 600,
            textAlign: 'center',
            mb: 1,
            color: state.status === 'success' 
              ? '#00ff88'
              : state.status === 'error'
              ? '#ff4466'
              : '#ffffff',
            letterSpacing: '0.05em',
            transition: 'color 0.5s ease',
          }}
        >
          {state.message}
        </Typography>

        {/* Subtitle */}
        <Typography
          sx={{
            fontSize: '0.8rem',
            textAlign: 'center',
            color: alpha('#ffffff', 0.5),
            mb: state.status === 'error' ? 2 : 0,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {state.status === 'processing' && 'Establishing secure connection...'}
          {state.status === 'success' && (window.opener ? 'Window closing automatically' : 'Redirecting to cluster...')}
          {state.status === 'error' && 'Security verification failed'}
        </Typography>

        {/* Error details */}
        {state.status === 'error' && state.error && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              background: alpha('#ff4466', 0.1),
              borderRadius: 2,
              border: `1px solid ${alpha('#ff4466', 0.2)}`,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: alpha('#ff4466', 0.9),
                fontFamily: 'inherit',
                wordBreak: 'break-word',
              }}
            >
              {state.error}
            </Typography>
          </Box>
        )}

        {/* Action buttons for error state */}
        {state.status === 'error' && (
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              justifyContent: 'center',
              mt: 3,
            }}
          >
            <Button
              onClick={handleRetry}
              sx={{
                px: 3,
                py: 1,
                fontSize: '0.75rem',
                fontFamily: 'inherit',
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: '#00d4ff',
                border: `1px solid ${alpha('#00d4ff', 0.3)}`,
                borderRadius: 2,
                background: alpha('#00d4ff', 0.05),
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: alpha('#00d4ff', 0.15),
                  borderColor: alpha('#00d4ff', 0.5),
                },
              }}
            >
              <Icon icon="mdi:refresh" width={16} style={{ marginRight: 6 }} />
              Retry
            </Button>
            <Button
              onClick={handleClose}
              sx={{
                px: 3,
                py: 1,
                fontSize: '0.75rem',
                fontFamily: 'inherit',
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: '#ffffff',
                border: `1px solid ${alpha('#ffffff', 0.2)}`,
                borderRadius: 2,
                background: alpha('#ffffff', 0.05),
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: alpha('#ffffff', 0.1),
                  borderColor: alpha('#ffffff', 0.3),
                },
              }}
            >
              <Icon icon="mdi:close" width={16} style={{ marginRight: 6 }} />
              Close
            </Button>
          </Box>
        )}

        {/* Progress indicator for success */}
        {state.status === 'success' && (
          <Box
            sx={{
              mt: 3,
              height: 3,
              borderRadius: 2,
              background: alpha('#00ff88', 0.2),
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                height: '100%',
                background: '#00ff88',
                animation: 'progress 1.8s ease-out forwards',
                '@keyframes progress': {
                  from: { width: '0%' },
                  to: { width: '100%' },
                },
              }}
            />
          </Box>
        )}

        {/* Footer branding */}
        <Box
          sx={{
            mt: 4,
            pt: 3,
            borderTop: `1px solid ${alpha('#ffffff', 0.1)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <Icon icon="mdi:server-security" width={14} style={{ color: alpha('#ffffff', 0.3) }} />
          <Typography
            sx={{
              fontSize: '0.65rem',
              color: alpha('#ffffff', 0.3),
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            Secure Authentication Portal
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
