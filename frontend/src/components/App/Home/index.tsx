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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Skeleton,
  Step,
  StepLabel,
  Stepper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { hasClusterToken, removeCluster as removeStoredCluster, saveCluster } from '../../../lib/clusterStorage';
import {
  listOIDCAuthMethods,
  startOIDCLogin,
  AuthMethod,
} from '../../../lib/nomad/api/oidc';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { setConfig } from '../../../redux/configSlice';
import { useTypedSelector } from '../../../redux/hooks';
import ClusterAvatar from '../../common/ClusterAvatar';
import ClusterErrorPage from '../ClusterErrorPage';

interface LocationState {
  clusterError?: {
    cluster: string;
    errorType: 'not_found' | 'auth_failed' | 'connection_failed' | 'unknown';
    message?: string;
  };
}

interface AddClusterFormData {
  name: string;
  address: string;
  region: string;
  namespace: string;
  token: string;
  authType: 'token' | 'oidc';
  oidcMethod?: string;
}

interface ClusterHealth {
  connected: boolean;
  error?: string;
  errorType?: 'auth' | 'connection' | 'unknown';
  nodes: { total: number; ready: number; down: number };
  jobs: { total: number; running: number; pending: number; dead: number };
  allocations: { total: number; running: number; pending: number; failed: number };
}

// Fetch health for a single cluster
async function fetchClusterHealth(clusterName: string): Promise<ClusterHealth> {
  try {
    const [nodesRes, jobsRes, allocsRes] = await Promise.all([
      fetch(`/api/clusters/${encodeURIComponent(clusterName)}/v1/nodes`),
      fetch(`/api/clusters/${encodeURIComponent(clusterName)}/v1/jobs`),
      fetch(`/api/clusters/${encodeURIComponent(clusterName)}/v1/allocations`),
    ]);

    for (const res of [nodesRes, jobsRes, allocsRes]) {
      if (res.status === 401 || res.status === 403) {
        return {
          connected: false,
          error: 'Token expired or invalid',
          errorType: 'auth',
          nodes: { total: 0, ready: 0, down: 0 },
          jobs: { total: 0, running: 0, pending: 0, dead: 0 },
          allocations: { total: 0, running: 0, pending: 0, failed: 0 },
        };
      }
      if (res.status === 500) {
        return {
          connected: false,
          error: 'Cluster not responding',
          errorType: 'connection',
          nodes: { total: 0, ready: 0, down: 0 },
          jobs: { total: 0, running: 0, pending: 0, dead: 0 },
          allocations: { total: 0, running: 0, pending: 0, failed: 0 },
        };
      }
    }

    if (!nodesRes.ok || !jobsRes.ok || !allocsRes.ok) {
      throw new Error('Failed to fetch cluster data');
    }

    const [nodes, jobs, allocs] = await Promise.all([
      nodesRes.json(),
      jobsRes.json(),
      allocsRes.json(),
    ]);

    return {
      connected: true,
      nodes: {
        total: nodes?.length || 0,
        ready: nodes?.filter((n: any) => n.Status === 'ready').length || 0,
        down: nodes?.filter((n: any) => n.Status === 'down').length || 0,
      },
      jobs: {
        total: jobs?.length || 0,
        running: jobs?.filter((j: any) => j.Status === 'running').length || 0,
        pending: jobs?.filter((j: any) => j.Status === 'pending').length || 0,
        dead: jobs?.filter((j: any) => j.Status === 'dead').length || 0,
      },
      allocations: {
        total: allocs?.length || 0,
        running: allocs?.filter((a: any) => a.ClientStatus === 'running').length || 0,
        pending: allocs?.filter((a: any) => a.ClientStatus === 'pending').length || 0,
        failed: allocs?.filter((a: any) => a.ClientStatus === 'failed').length || 0,
      },
    };
  } catch (error) {
    return {
      connected: false,
      error: (error as Error).message,
      errorType: 'unknown',
      nodes: { total: 0, ready: 0, down: 0 },
      jobs: { total: 0, running: 0, pending: 0, dead: 0 },
      allocations: { total: 0, running: 0, pending: 0, failed: 0 },
    };
  }
}

// Improved Add Cluster Dialog with stepper and OIDC support
function AddClusterDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (data: AddClusterFormData) => Promise<void>;
}) {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<AddClusterFormData>({
    name: '',
    address: '',
    region: '',
    namespace: '',
    token: '',
    authType: 'token',
    oidcMethod: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [oidcMethods, setOidcMethods] = useState<AuthMethod[]>([]);
  const [loadingOidc, setLoadingOidc] = useState(false);
  const [oidcStatus, setOidcStatus] = useState<'idle' | 'waiting' | 'success' | 'error'>('idle');

  const steps = ['Connection', 'Authentication', 'Confirm'];

  // Listen for OIDC callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'oidc-callback-success') {
        setOidcStatus('success');
        setTestResult('success');
        setActiveStep(2);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Fetch OIDC methods when cluster is added
  const fetchOidcMethods = useCallback(async (clusterName: string) => {
    setLoadingOidc(true);
    try {
      const methods = await listOIDCAuthMethods(clusterName);
      setOidcMethods(methods);
      if (methods.length > 0) {
        setFormData(prev => ({ ...prev, oidcMethod: methods[0].name }));
      }
    } catch (err) {
      console.warn('Failed to fetch OIDC methods:', err);
      setOidcMethods([]);
    }
    setLoadingOidc(false);
  }, []);

  const handleNext = async () => {
    setError(null);

    if (activeStep === 0) {
      // Validate connection details
      if (!formData.name.trim()) {
        setError('Cluster name is required');
        return;
      }
      if (!formData.address.trim()) {
        setError('Nomad address is required');
        return;
      }
      try {
        new URL(formData.address);
      } catch {
        setError('Invalid address format. Use a valid URL (e.g., https://nomad.example.com)');
        return;
      }

      // Add the cluster first so we can check auth methods
      setLoading(true);
      try {
        const addClusterData = {
          name: formData.name,
          address: formData.address,
          region: formData.region,
          namespace: formData.namespace,
        };
        const testResponse = await fetch('/api/cluster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(addClusterData),
        });

        if (!testResponse.ok) {
          throw new Error('Failed to add cluster');
        }

        // Fetch OIDC methods for this cluster
        await fetchOidcMethods(formData.name);
        setActiveStep(1);
      } catch (err) {
        setError((err as Error).message);
      }
      setLoading(false);
    } else if (activeStep === 1) {
      // Skip to confirm if using OIDC (auth happens via popup)
      if (formData.authType === 'oidc') {
        if (oidcStatus === 'success') {
          setActiveStep(2);
          return;
        }
        setError('Please complete OIDC authentication first');
        return;
      }

      // Test connection and validate token
      setLoading(true);
      try {
        // If token provided, validate it via login endpoint
        if (formData.token.trim()) {
          const loginResponse = await fetch(
            `/api/clusters/${encodeURIComponent(formData.name)}/v1/auth/login`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: formData.token.trim() }),
              credentials: 'include',
            }
          );

          if (!loginResponse.ok) {
            const errorData = await loginResponse.json().catch(() => ({}));
            const errorMessage = errorData.error || 'Invalid token';
            setTestResult('error');
            setError(`Token validation failed: ${errorMessage}`);
            setLoading(false);
            return;
          }
        }

        // Try to fetch nodes to test connection (will use cookie if token was set)
        const healthResponse = await fetch(
          `/api/clusters/${encodeURIComponent(formData.name)}/v1/nodes`,
          { credentials: 'include' }
        );

        if (healthResponse.ok) {
          setTestResult('success');
          setActiveStep(2);
        } else if (healthResponse.status === 401 || healthResponse.status === 403) {
          setTestResult('error');
          setError('Authentication required. Please provide a valid ACL token.');
        } else {
          setTestResult('error');
          const errorData = await healthResponse.json().catch(() => ({}));
          setError(errorData.error || 'Could not connect to cluster. Please verify the address.');
        }
      } catch (err) {
        setTestResult('error');
        setError((err as Error).message);
      }
      setLoading(false);
    } else {
      // Final step - submit
      setLoading(true);
      try {
        await onAdd(formData);
        handleClose();
      } catch (err) {
        setError((err as Error).message);
      }
      setLoading(false);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
    setError(null);
    setTestResult(null);
    setOidcStatus('idle');
  };

  const handleClose = () => {
    setFormData({ name: '', address: '', region: '', namespace: '', token: '', authType: 'token', oidcMethod: '' });
    setError(null);
    setActiveStep(0);
    setTestResult(null);
    setOidcStatus('idle');
    setOidcMethods([]);
    onClose();
  };

  const handleOidcLogin = async () => {
    if (!formData.oidcMethod) {
      setError('Please select an authentication method');
      return;
    }

    setOidcStatus('waiting');
    setError(null);

    try {
      const popup = await startOIDCLogin(formData.name, formData.oidcMethod);
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

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon icon="mdi:server-plus" width={24} />
          Add Nomad Cluster
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ pt: 2, pb: 4 }}>
          {steps.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {activeStep === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Cluster Name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="production-us-west"
              fullWidth
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon icon="mdi:label-outline" width={20} />
                  </InputAdornment>
                ),
              }}
              helperText="A unique, friendly name to identify this cluster"
            />
            <TextField
              label="Nomad Address"
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              placeholder="https://nomad.example.com:4646"
              fullWidth
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon icon="mdi:link" width={20} />
                  </InputAdornment>
                ),
              }}
              helperText="The HTTP(S) address of the Nomad server"
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Region"
                value={formData.region}
                onChange={e => setFormData({ ...formData, region: e.target.value })}
                placeholder="global"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Icon icon="mdi:map-marker" width={20} />
                    </InputAdornment>
                  ),
                }}
                helperText="Optional"
              />
              <TextField
                label="Namespace"
                value={formData.namespace}
                onChange={e => setFormData({ ...formData, namespace: e.target.value })}
                placeholder="default"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Icon icon="mdi:folder-outline" width={20} />
                    </InputAdornment>
                  ),
                }}
                helperText="Optional"
              />
            </Box>
          </Box>
        )}

        {activeStep === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: alpha(theme.palette.info.main, 0.05),
                borderColor: theme.palette.info.main,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Icon icon="mdi:information" width={20} color={theme.palette.info.main} />
                <Typography variant="subtitle2" color="info.main">
                  Authentication
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Choose how to authenticate with this Nomad cluster.
              </Typography>
            </Paper>

            <FormControl>
              <RadioGroup
                value={formData.authType}
                onChange={e => setFormData({ ...formData, authType: e.target.value as 'token' | 'oidc' })}
              >
                <FormControlLabel
                  value="token"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1">ACL Token</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Use a Nomad ACL token directly
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 1, alignItems: 'flex-start', '& .MuiRadio-root': { pt: 0.5 } }}
                />
                <FormControlLabel
                  value="oidc"
                  control={<Radio />}
                  disabled={oidcMethods.length === 0 && !loadingOidc}
                  label={
                    <Box>
                      <Typography variant="body1">
                        SSO / OIDC
                        {loadingOidc && <CircularProgress size={12} sx={{ ml: 1 }} />}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {oidcMethods.length > 0
                          ? `Sign in with ${oidcMethods.map(m => m.name).join(', ')}`
                          : loadingOidc
                          ? 'Checking available methods...'
                          : 'No OIDC methods configured on this cluster'}
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start', '& .MuiRadio-root': { pt: 0.5 } }}
                />
              </RadioGroup>
            </FormControl>

            {formData.authType === 'token' && (
              <TextField
                label="ACL Token"
                value={formData.token}
                onChange={e => setFormData({ ...formData, token: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                fullWidth
                type="password"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Icon icon="mdi:key" width={20} />
                    </InputAdornment>
                  ),
                }}
                helperText="Your Nomad ACL token (optional if ACL is disabled)"
              />
            )}

            {formData.authType === 'oidc' && oidcMethods.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {oidcMethods.length > 1 && (
                  <FormControl fullWidth size="small">
                    <InputLabel>Authentication Method</InputLabel>
                    <Select
                      value={formData.oidcMethod || ''}
                      label="Authentication Method"
                      onChange={e => setFormData({ ...formData, oidcMethod: e.target.value })}
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
                  size="large"
                  onClick={handleOidcLogin}
                  disabled={oidcStatus === 'waiting'}
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
                  sx={{ py: 1.5 }}
                >
                  {oidcStatus === 'waiting'
                    ? 'Waiting for authentication...'
                    : oidcStatus === 'success'
                    ? 'Authenticated!'
                    : `Sign in with ${formData.oidcMethod || oidcMethods[0]?.name || 'SSO'}`}
                </Button>

                {oidcStatus === 'waiting' && (
                  <Alert severity="info">
                    Complete the authentication in the popup window. This dialog will update automatically.
                  </Alert>
                )}
              </Box>
            )}

            {testResult === 'success' && formData.authType === 'token' && (
              <Alert severity="success" icon={<Icon icon="mdi:check-circle" />}>
                Successfully connected to cluster!
              </Alert>
            )}
          </Box>
        )}

        {activeStep === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="success" icon={<Icon icon="mdi:check-circle" />}>
              {formData.authType === 'oidc'
                ? 'OIDC authentication successful! Ready to add cluster.'
                : 'Connection verified! Ready to add cluster.'}
            </Alert>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Cluster Summary
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 1, mt: 1 }}>
                <Typography variant="body2" color="text.secondary">Name:</Typography>
                <Typography variant="body2" fontWeight={600}>{formData.name}</Typography>
                <Typography variant="body2" color="text.secondary">Address:</Typography>
                <Typography variant="body2" fontFamily="monospace">{formData.address}</Typography>
                {formData.region && (
                  <>
                    <Typography variant="body2" color="text.secondary">Region:</Typography>
                    <Typography variant="body2">{formData.region}</Typography>
                  </>
                )}
                <Typography variant="body2" color="text.secondary">Auth:</Typography>
                <Typography variant="body2">
                  {formData.authType === 'oidc'
                    ? `OIDC (${formData.oidcMethod})`
                    : formData.token
                    ? 'ACL Token configured'
                    : 'No authentication'}
                </Typography>
              </Box>
            </Paper>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        <Button
          onClick={handleNext}
          variant="contained"
          disabled={loading || (activeStep === 1 && formData.authType === 'oidc' && oidcStatus !== 'success')}
          startIcon={loading ? undefined : activeStep === 2 ? <Icon icon="mdi:check" /> : <Icon icon="mdi:arrow-right" />}
        >
          {loading ? 'Please wait...' : activeStep === 2 ? 'Add Cluster' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Delete confirmation dialog
function DeleteClusterDialog({
  open,
  clusterName,
  onClose,
  onDelete,
}: {
  open: boolean;
  clusterName: string;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Icon icon="mdi:alert-circle" color="error" width={24} />
        Remove Cluster
      </DialogTitle>
      <DialogContent>
        <Typography>
          Remove <strong>{clusterName}</strong> from the dashboard?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This only removes it from the UI. The actual Nomad cluster is not affected.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onDelete} color="error" variant="contained">
          Remove
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Hero stat component - large, prominent display
function HeroStat({
  value,
  label,
  icon,
  color,
  loading,
  subtitle,
}: {
  value: number;
  label: string;
  icon: string;
  color: string;
  loading?: boolean;
  subtitle?: string;
}) {
  const theme = useTheme();
  
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2.5,
        borderRadius: 2,
        background: alpha(color, 0.08),
        border: `1px solid ${alpha(color, 0.2)}`,
        transition: 'all 0.2s ease',
        '&:hover': {
          background: alpha(color, 0.12),
          borderColor: alpha(color, 0.3),
        },
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          background: `linear-gradient(135deg, ${color} 0%, ${alpha(color, 0.7)} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 12px ${alpha(color, 0.3)}`,
        }}
      >
        <Icon icon={icon} width={24} style={{ color: 'white' }} />
      </Box>
      <Box sx={{ flex: 1 }}>
        {loading ? (
          <Skeleton width={60} height={36} />
        ) : (
          <Typography
            sx={{
              fontSize: '1.75rem',
              fontWeight: 700,
              lineHeight: 1,
              color: theme.palette.text.primary,
            }}
          >
            {value.toLocaleString()}
          </Typography>
        )}
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
            fontWeight: 500,
            mt: 0.25,
          }}
        >
          {label}
        </Typography>
        {subtitle && (
          <Typography variant="caption" sx={{ color: alpha(theme.palette.text.secondary, 0.7) }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// Enhanced cluster card
function ClusterCard({
  name,
  server,
  health,
  loading,
  onDelete,
}: {
  name: string;
  server: string;
  health: ClusterHealth | null;
  loading: boolean;
  onDelete: (name: string) => void;
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [showActions, setShowActions] = useState(false);

  const getHealthStatus = () => {
    if (!health?.connected) return 'error';
    if (health.nodes.down > 0 || health.allocations.failed > 0) return 'warning';
    return 'success';
  };

  const healthStatus = getHealthStatus();
  const healthColors = {
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    error: theme.palette.error.main,
  };

  const handleClick = () => {
    if (hasClusterToken(name)) {
      navigate(createRouteURL('nomadCluster', { cluster: name }));
    } else {
      navigate(createRouteURL('login', { cluster: name }));
    }
  };

  const isLocal = server?.includes('localhost') || server?.includes('127.0.0.1');

  return (
    <Card
      sx={{
        height: '100%',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        borderLeft: `4px solid ${health ? healthColors[healthStatus] : theme.palette.divider}`,
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[4],
        },
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={handleClick}
    >
      <CardContent sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <Box sx={{ position: 'relative' }}>
            <ClusterAvatar name={name} size={44} />
            {health && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: healthColors[healthStatus],
                  border: `2px solid ${theme.palette.background.paper}`,
                }}
              />
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  fontSize: '1rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {name}
              </Typography>
              {isLocal && (
                <Chip size="small" label="Local" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: 'monospace', display: 'block' }}
            >
              {server ? new URL(server).host : 'Unknown'}
            </Typography>
          </Box>
          {showActions && (
            <IconButton
              size="small"
              onClick={e => {
                e.stopPropagation();
                onDelete(name);
              }}
              sx={{
                opacity: 0.7,
                '&:hover': { opacity: 1, color: 'error.main' },
              }}
            >
              <Icon icon="mdi:delete-outline" width={18} />
            </IconButton>
          )}
        </Box>

        {/* Stats */}
        <Box sx={{ flex: 1 }}>
          {loading ? (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Skeleton width={60} height={24} />
              <Skeleton width={60} height={24} />
              <Skeleton width={60} height={24} />
            </Box>
          ) : health?.connected ? (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Tooltip title={`${health.nodes.ready} ready / ${health.nodes.total} total nodes`}>
                <Chip
                  size="small"
                  icon={<Icon icon="mdi:server" width={14} />}
                  label={`${health.nodes.ready}/${health.nodes.total}`}
                  variant="outlined"
                  color={health.nodes.down > 0 ? 'warning' : 'default'}
                />
              </Tooltip>
              <Tooltip title={`${health.jobs.running} running jobs`}>
                <Chip
                  size="small"
                  icon={<Icon icon="mdi:briefcase-outline" width={14} />}
                  label={health.jobs.running}
                  variant="outlined"
                  color={health.jobs.running > 0 ? 'success' : 'default'}
                />
              </Tooltip>
              <Tooltip title={`${health.allocations.running} running allocations`}>
                <Chip
                  size="small"
                  icon={<Icon icon="mdi:cube-outline" width={14} />}
                  label={health.allocations.running}
                  variant="outlined"
                  color={health.allocations.running > 0 ? 'primary' : 'default'}
                />
              </Tooltip>
              {health.allocations.failed > 0 && (
                <Tooltip title={`${health.allocations.failed} failed allocations`}>
                  <Chip
                    size="small"
                    icon={<Icon icon="mdi:alert" width={14} />}
                    label={health.allocations.failed}
                    color="error"
                  />
                </Tooltip>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Icon
                icon={health?.errorType === 'auth' ? 'mdi:key-alert' : 'mdi:cloud-off-outline'}
                width={18}
                color={health?.errorType === 'auth' ? theme.palette.warning.main : theme.palette.error.main}
              />
              <Typography variant="body2" color={health?.errorType === 'auth' ? 'warning.main' : 'error.main'}>
                {health?.errorType === 'auth' ? 'Re-authenticate required' : 'Connection failed'}
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

// Empty state component
function EmptyState({ onAddCluster }: { onAddCluster: () => void }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 8,
        px: 4,
        maxWidth: 500,
        mx: 'auto',
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
          mb: 3,
        }}
      >
        <Icon icon="mdi:server-network" width={40} color={theme.palette.primary.main} />
      </Box>

      <Typography variant="h5" fontWeight={600} gutterBottom>
        Welcome to Nomad Dashboard
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        Connect your first Nomad cluster to start monitoring and managing your workloads.
      </Typography>

      <Button
        variant="contained"
        size="large"
        startIcon={<Icon icon="mdi:plus" />}
        onClick={onAddCluster}
        sx={{ px: 4 }}
      >
        Add Cluster
      </Button>

      <Divider sx={{ my: 4 }}>
        <Typography variant="caption" color="text.secondary">
          OR
        </Typography>
      </Divider>

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          bgcolor: alpha(theme.palette.info.main, 0.02),
          borderColor: alpha(theme.palette.info.main, 0.2),
        }}
      >
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Set environment variable:
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'monospace',
            bgcolor: 'action.hover',
            px: 1.5,
            py: 0.75,
            borderRadius: 1,
            display: 'inline-block',
          }}
        >
          NOMAD_ADDR=https://nomad.example.com
        </Typography>
      </Paper>
    </Box>
  );
}

export default function Home() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const state = location.state as LocationState | null;
  const theme = useTheme();
  const clusters = useTypedSelector(state => state.config.clusters) || {};

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clusterToDelete, setClusterToDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [clusterHealth, setClusterHealth] = useState<Record<string, ClusterHealth>>({});
  const [loading, setLoading] = useState(true);

  const [clusterError, setClusterError] = useState(location.state?.clusterError);

  // Check for ?add=true query param to auto-open add dialog
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setAddDialogOpen(true);
      // Remove the query param
      searchParams.delete('add');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const clusterList = useMemo(() => {
    return Object.entries(clusters)
      .map(([name, cluster]) => ({ name, server: cluster?.server || '' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clusters]);

  const filteredClusters = useMemo(() => {
    if (!searchQuery) return clusterList;
    const query = searchQuery.toLowerCase();
    return clusterList.filter(
      c => c.name.toLowerCase().includes(query) || c.server.toLowerCase().includes(query)
    );
  }, [clusterList, searchQuery]);

  const clusterCount = clusterList.length;

  // Clear location state after reading
  useEffect(() => {
    if (state?.clusterError) {
      navigate('/clusters', { replace: true, state: undefined });
    }
  }, []);

  // Fetch health for all clusters
  useEffect(() => {
    let mounted = true;

    const loadHealth = async () => {
      setLoading(true);
      const healthPromises = clusterList.map(async c => {
        const health = await fetchClusterHealth(c.name);
        return { name: c.name, health };
      });

      const results = await Promise.all(healthPromises);

      if (mounted) {
        const healthMap: Record<string, ClusterHealth> = {};
        results.forEach(r => {
          healthMap[r.name] = r.health;
        });
        setClusterHealth(healthMap);
        setLoading(false);
      }
    };

    if (clusterCount > 0) {
      loadHealth();
      const interval = setInterval(loadHealth, 30000);
      return () => {
        mounted = false;
        clearInterval(interval);
      };
    } else {
      setLoading(false);
    }
  }, [clusterList.map(c => c.name).join(',')]);

  // Calculate aggregate stats
  const aggregate = useMemo(() => {
    const stats = {
      clusters: { total: clusterCount, connected: 0, disconnected: 0 },
      nodes: { total: 0, ready: 0, down: 0 },
      jobs: { total: 0, running: 0, pending: 0, dead: 0 },
      allocations: { total: 0, running: 0, pending: 0, failed: 0 },
    };

    Object.values(clusterHealth).forEach(h => {
      if (h.connected) {
        stats.clusters.connected++;
        stats.nodes.total += h.nodes.total;
        stats.nodes.ready += h.nodes.ready;
        stats.nodes.down += h.nodes.down;
        stats.jobs.total += h.jobs.total;
        stats.jobs.running += h.jobs.running;
        stats.jobs.pending += h.jobs.pending;
        stats.jobs.dead += h.jobs.dead;
        stats.allocations.total += h.allocations.total;
        stats.allocations.running += h.allocations.running;
        stats.allocations.pending += h.allocations.pending;
        stats.allocations.failed += h.allocations.failed;
      } else {
        stats.clusters.disconnected++;
      }
    });

    return stats;
  }, [clusterHealth, clusterCount]);

  if (clusterError) {
    return (
      <ClusterErrorPage
        clusterName={clusterError.cluster}
        errorType={clusterError.errorType}
        errorMessage={clusterError.message}
        onResolved={() => setClusterError(undefined)}
      />
    );
  }

  const handleAddCluster = async (data: AddClusterFormData) => {
    // Already added during test, just save to localStorage
    // For OIDC auth, the token was already set to 'authenticated' by OIDCCallback
    // For token auth, use the provided token
    const tokenValue = data.authType === 'oidc' 
      ? 'authenticated'  // OIDC sets HTTPOnly cookie, mark as authenticated
      : (data.token || undefined);
    
    saveCluster({
      name: data.name,
      address: data.address,
      region: data.region || undefined,
      namespace: data.namespace || undefined,
      token: tokenValue,
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
    setError(null);
  };

  const handleDeleteCluster = async () => {
    if (!clusterToDelete) return;

    try {
      const response = await fetch(`/api/cluster/${encodeURIComponent(clusterToDelete)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete cluster');
      }

      removeStoredCluster(clusterToDelete);

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
      setDeleteDialogOpen(false);
      setClusterToDelete(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {clusterCount === 0 ? (
        <EmptyState onAddCluster={() => setAddDialogOpen(true)} />
      ) : (
        <>
          {/* Hero Section - Overview Stats */}
          <Box
            sx={{
              mb: 4,
              p: { xs: 2, sm: 3 },
              borderRadius: 3,
              background: theme => 
                theme.palette.mode === 'dark'
                  ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.15)} 0%, ${alpha('#0a0e17', 0.8)} 100%)`
                  : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, ${alpha(theme.palette.background.paper, 1)} 100%)`,
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            }}
          >
            {/* Header Row */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
              <Box>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700,
                    background: theme.palette.mode === 'dark' 
                      ? 'linear-gradient(135deg, #fff 0%, #b0b0b0 100%)'
                      : 'linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Clusters
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {aggregate.clusters.connected} of {clusterCount} connected
                  {aggregate.nodes.down > 0 && (
                    <Typography component="span" sx={{ color: 'warning.main', ml: 1 }}>
                      • {aggregate.nodes.down} node{aggregate.nodes.down !== 1 ? 's' : ''} down
                    </Typography>
                  )}
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<Icon icon="mdi:plus" />}
                onClick={() => setAddDialogOpen(true)}
                sx={{
                  px: 2.5,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.35)}`,
                  '&:hover': {
                    boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.45)}`,
                  },
                }}
              >
                Add Cluster
              </Button>
            </Box>

            {/* Stats Row - Only show for multiple clusters */}
            {clusterCount > 1 && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <HeroStat
                    value={aggregate.clusters.connected}
                    label="Connected Clusters"
                    icon="mdi:check-network"
                    color="#00ca8e"
                    loading={loading}
                    subtitle={aggregate.clusters.disconnected > 0 ? `${aggregate.clusters.disconnected} offline` : 'All online'}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <HeroStat
                    value={aggregate.nodes.total}
                    label="Total Nodes"
                    icon="mdi:server"
                    color="#3b82f6"
                    loading={loading}
                    subtitle={aggregate.nodes.down > 0 ? `${aggregate.nodes.down} down` : 'All healthy'}
                  />
                </Grid>
              </Grid>
            )}
          </Box>

          {/* Search and View Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <TextField
              placeholder="Search clusters..."
              size="small"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon icon="mdi:magnify" width={20} />
                  </InputAdornment>
                ),
              }}
              sx={{ 
                width: { xs: '100%', sm: 280 },
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />
            <Box sx={{ flex: 1 }} />
            <ToggleButtonGroup
              size="small"
              value={viewMode}
              exclusive
              onChange={(_, value) => value && setViewMode(value)}
              sx={{
                '& .MuiToggleButton-root': {
                  borderRadius: 1.5,
                  px: 1.5,
                },
              }}
            >
              <ToggleButton value="grid">
                <Icon icon="mdi:view-grid" width={20} />
              </ToggleButton>
              <ToggleButton value="list">
                <Icon icon="mdi:view-list" width={20} />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Cluster Grid/List */}
          <Grid container spacing={2}>
            {filteredClusters.map(cluster => (
              <Grid
                size={{
                  xs: 12,
                  sm: viewMode === 'grid' ? 6 : 12,
                  md: viewMode === 'grid' ? 4 : 12,
                  lg: viewMode === 'grid' ? 3 : 12,
                }}
                key={cluster.name}
              >
                <ClusterCard
                  name={cluster.name}
                  server={cluster.server}
                  health={clusterHealth[cluster.name] || null}
                  loading={loading}
                  onDelete={name => {
                    setClusterToDelete(name);
                    setDeleteDialogOpen(true);
                  }}
                />
              </Grid>
            ))}
          </Grid>

          {filteredClusters.length === 0 && searchQuery && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Icon icon="mdi:magnify" width={48} style={{ opacity: 0.3 }} />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                No clusters match "{searchQuery}"
              </Typography>
            </Box>
          )}
        </>
      )}

      <AddClusterDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddCluster}
      />

      <DeleteClusterDialog
        open={deleteDialogOpen}
        clusterName={clusterToDelete || ''}
        onClose={() => {
          setDeleteDialogOpen(false);
          setClusterToDelete(null);
        }}
        onDelete={handleDeleteCluster}
      />
    </Box>
  );
}
