import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  IconButton,
  Skeleton,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { hasClusterToken } from '../../../lib/clusterStorage';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import ClusterAvatar from '../../common/ClusterAvatar';

interface ClusterHealth {
  nodes: { total: number; ready: number; down: number };
  jobs: { total: number; running: number; dead: number };
  allocations: { running: number; pending: number; failed: number };
  connected: boolean;
  error?: string;
  errorType?: 'auth' | 'connection' | 'unknown';
}

interface ClusterHealthCardProps {
  name: string;
  cluster: {
    server?: string;
    [key: string]: any;
  };
  onDelete?: (name: string) => void;
}

/**
 * Fetches cluster health stats from the backend
 */
async function fetchClusterHealth(clusterName: string): Promise<ClusterHealth> {
  try {
    // Fetch nodes, jobs, and allocations in parallel
    const [nodesRes, jobsRes, allocsRes] = await Promise.all([
      fetch(`/api/clusters/${encodeURIComponent(clusterName)}/v1/nodes`),
      fetch(`/api/clusters/${encodeURIComponent(clusterName)}/v1/jobs`),
      fetch(`/api/clusters/${encodeURIComponent(clusterName)}/v1/allocations`),
    ]);

    // Check for auth errors (401/403)
    const responses = [nodesRes, jobsRes, allocsRes];
    for (const res of responses) {
      if (res.status === 401 || res.status === 403) {
        return {
          nodes: { total: 0, ready: 0, down: 0 },
          jobs: { total: 0, running: 0, dead: 0 },
          allocations: { running: 0, pending: 0, failed: 0 },
          connected: false,
          error: 'Token expired or invalid',
          errorType: 'auth',
        };
      }
      if (res.status === 500) {
        // Backend error - cluster may not be registered
        return {
          nodes: { total: 0, ready: 0, down: 0 },
          jobs: { total: 0, running: 0, dead: 0 },
          allocations: { running: 0, pending: 0, failed: 0 },
          connected: false,
          error: 'Cluster not responding',
          errorType: 'connection',
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

    // Calculate node stats
    const nodeStats = {
      total: nodes?.length || 0,
      ready: nodes?.filter((n: any) => n.Status === 'ready').length || 0,
      down: nodes?.filter((n: any) => n.Status === 'down').length || 0,
    };

    // Calculate job stats
    const jobStats = {
      total: jobs?.length || 0,
      running: jobs?.filter((j: any) => j.Status === 'running').length || 0,
      dead: jobs?.filter((j: any) => j.Status === 'dead').length || 0,
    };

    // Calculate allocation stats
    const allocStats = {
      running: allocs?.filter((a: any) => a.ClientStatus === 'running').length || 0,
      pending: allocs?.filter((a: any) => a.ClientStatus === 'pending').length || 0,
      failed: allocs?.filter((a: any) => a.ClientStatus === 'failed').length || 0,
    };

    return {
      nodes: nodeStats,
      jobs: jobStats,
      allocations: allocStats,
      connected: true,
    };
  } catch (error) {
    return {
      nodes: { total: 0, ready: 0, down: 0 },
      jobs: { total: 0, running: 0, dead: 0 },
      allocations: { running: 0, pending: 0, failed: 0 },
      connected: false,
      error: (error as Error).message,
      errorType: 'unknown',
    };
  }
}

/**
 * Compact stat display for cluster cards
 */
function StatItem({
  icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  subValue?: string;
  color?: 'success' | 'error' | 'warning';
}) {
  const theme = useTheme();
  const colorMap = {
    success: theme.palette.success.main,
    error: theme.palette.error.main,
    warning: theme.palette.warning.main,
  };

  return (
    <Tooltip title={label}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Icon icon={icon} width={14} style={{ opacity: 0.6 }} />
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            fontSize: '0.8125rem',
            color: color ? colorMap[color] : 'text.primary',
          }}
        >
          {value}
        </Typography>
        {subValue && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
            {subValue}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}

/**
 * ClusterHealthCard - Enhanced cluster card with health status
 */
export default function ClusterHealthCard({ name, cluster, onDelete }: ClusterHealthCardProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [health, setHealth] = useState<ClusterHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadHealth = async () => {
      setLoading(true);
      const data = await fetchClusterHealth(name);
      if (mounted) {
        setHealth(data);
        setLoading(false);
      }
    };

    loadHealth();

    // Refresh health every 30 seconds
    const interval = setInterval(loadHealth, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [name]);

  const handleClick = () => {
    // If a token already exists for this cluster, go directly to the cluster
    // Otherwise, go to the login page
    if (hasClusterToken(name)) {
      navigate(createRouteURL('nomadCluster', { cluster: name }));
    } else {
      navigate(createRouteURL('login', { cluster: name }));
    }
  };

  const server = cluster?.server || '';
  const isLocal = server.includes('localhost') || server.includes('127.0.0.1');

  // Determine overall health status
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

  return (
    <Card
      sx={{
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
        position: 'relative',
        borderLeft: `3px solid ${health ? healthColors[healthStatus] : theme.palette.divider}`,
      }}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      {onDelete && showDelete && (
        <IconButton
          size="small"
          onClick={e => {
            e.stopPropagation();
            onDelete(name);
          }}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
            bgcolor: 'background.paper',
            '&:hover': { bgcolor: 'error.light', color: 'white' },
          }}
        >
          <Icon icon="mdi:delete" width={18} />
        </IconButton>
      )}

      <CardActionArea onClick={handleClick} sx={{ height: '100%' }}>
        <CardContent sx={{ p: 2.5, minHeight: 140 }}>
          {/* Header: Avatar + Name + Status */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <ClusterAvatar name={name} size={48} />
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.3,
                    fontSize: '1.1rem',
                  }}
                >
                  {name}
                </Typography>
                {isLocal && (
                  <Chip
                    size="small"
                    label="Local"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                )}
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                }}
              >
                {server ? new URL(server).host : 'Nomad Cluster'}
              </Typography>
            </Box>
          </Box>

          {/* Health Stats */}
          {loading ? (
            <Box sx={{ display: 'flex', gap: 3, pt: 1.5, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Skeleton width={80} height={24} />
              <Skeleton width={80} height={24} />
              <Skeleton width={80} height={24} />
            </Box>
          ) : health?.connected ? (
            <Box
              sx={{
                display: 'flex',
                gap: 3,
                flexWrap: 'wrap',
                pt: 1.5,
                borderTop: `1px solid ${theme.palette.divider}`,
              }}
            >
              <StatItem
                icon="mdi:server"
                label={`${health.nodes.ready}/${health.nodes.total} nodes ready`}
                value={health.nodes.ready}
                subValue={`/${health.nodes.total} nodes`}
                color={health.nodes.down > 0 ? 'warning' : undefined}
              />
              <StatItem
                icon="mdi:briefcase-outline"
                label={`${health.jobs.running} running jobs`}
                value={health.jobs.running}
                subValue=" jobs"
                color={health.jobs.running > 0 ? 'success' : undefined}
              />
              <StatItem
                icon="mdi:cube-outline"
                label={`${health.allocations.running} running allocations`}
                value={health.allocations.running}
                subValue=" allocs"
                color={health.allocations.failed > 0 ? 'warning' : 'success'}
              />
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                pt: 1.5,
                borderTop: `1px solid ${theme.palette.divider}`,
                color: health?.errorType === 'auth' ? 'warning.main' : 'error.main',
              }}
            >
              <Icon
                icon={health?.errorType === 'auth' ? 'mdi:key-alert' : 'mdi:alert-circle'}
                width={20}
              />
              <Typography variant="body2">
                {health?.errorType === 'auth'
                  ? 'Token expired - click to re-authenticate'
                  : health?.error || 'Unable to connect'}
              </Typography>
            </Box>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
