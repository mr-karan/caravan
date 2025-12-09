import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  LinearProgress,
  Link,
  Paper,
  Skeleton,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { useTypedSelector } from '../../../redux/hooks';
import ClusterAvatar from '../../common/ClusterAvatar';
import { PageGrid } from '../../common/Resource';
import SectionBox from '../../common/SectionBox';

interface ClusterStats {
  name: string;
  server: string;
  connected: boolean;
  error?: string;
  nodes: { total: number; ready: number; down: number };
  jobs: { total: number; running: number; pending: number; dead: number };
  allocations: { total: number; running: number; pending: number; failed: number };
}

interface AggregateStats {
  clusters: { total: number; connected: number; disconnected: number };
  nodes: { total: number; ready: number; down: number };
  jobs: { total: number; running: number; pending: number; dead: number };
  allocations: { total: number; running: number; pending: number; failed: number };
}

async function fetchClusterStats(clusterName: string, server: string): Promise<ClusterStats> {
  try {
    const [nodesRes, jobsRes, allocsRes] = await Promise.all([
      fetch(`/api/clusters/${encodeURIComponent(clusterName)}/v1/nodes`),
      fetch(`/api/clusters/${encodeURIComponent(clusterName)}/v1/jobs`),
      fetch(`/api/clusters/${encodeURIComponent(clusterName)}/v1/allocations`),
    ]);

    if (!nodesRes.ok || !jobsRes.ok || !allocsRes.ok) {
      throw new Error('API error');
    }

    const [nodes, jobs, allocs] = await Promise.all([
      nodesRes.json(),
      jobsRes.json(),
      allocsRes.json(),
    ]);

    return {
      name: clusterName,
      server,
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
      name: clusterName,
      server,
      connected: false,
      error: (error as Error).message,
      nodes: { total: 0, ready: 0, down: 0 },
      jobs: { total: 0, running: 0, pending: 0, dead: 0 },
      allocations: { total: 0, running: 0, pending: 0, failed: 0 },
    };
  }
}

function StatCard({
  title,
  icon,
  total,
  breakdown,
  loading,
}: {
  title: string;
  icon: string;
  total: number;
  breakdown: { label: string; value: number; color: string }[];
  loading?: boolean;
}) {
  const theme = useTheme();

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Icon icon={icon} width={24} style={{ opacity: 0.7 }} />
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
        </Box>

        {loading ? (
          <Skeleton variant="text" width={80} height={48} />
        ) : (
          <Typography variant="h3" sx={{ fontWeight: 600, mb: 2 }}>
            {total.toLocaleString()}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {breakdown.map(item => (
            <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: item.color,
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {loading ? <Skeleton width={40} /> : `${item.value} ${item.label}`}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

function ClusterRow({ stats }: { stats: ClusterStats }) {
  const theme = useTheme();

  const healthColor = !stats.connected
    ? theme.palette.error.main
    : stats.nodes.down > 0 || stats.allocations.failed > 0
    ? theme.palette.warning.main
    : theme.palette.success.main;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderLeft: `3px solid ${healthColor}`,
      }}
    >
      <ClusterAvatar name={stats.name} size={36} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Link
          component={RouterLink}
          to={createRouteURL('login', { cluster: stats.name })}
          sx={{ fontWeight: 600, fontSize: '0.9rem' }}
        >
          {stats.name}
        </Link>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {stats.server ? new URL(stats.server).host : 'Unknown'}
        </Typography>
      </Box>

      {stats.connected ? (
        <>
          <Tooltip title="Nodes">
            <Chip
              size="small"
              icon={<Icon icon="mdi:server" width={14} />}
              label={`${stats.nodes.ready}/${stats.nodes.total}`}
              sx={{ minWidth: 70 }}
            />
          </Tooltip>
          <Tooltip title="Running Jobs">
            <Chip
              size="small"
              icon={<Icon icon="mdi:briefcase-outline" width={14} />}
              label={stats.jobs.running}
              color={stats.jobs.running > 0 ? 'success' : 'default'}
              sx={{ minWidth: 50 }}
            />
          </Tooltip>
          <Tooltip title="Running Allocations">
            <Chip
              size="small"
              icon={<Icon icon="mdi:cube-outline" width={14} />}
              label={stats.allocations.running}
              color={stats.allocations.running > 0 ? 'primary' : 'default'}
              sx={{ minWidth: 50 }}
            />
          </Tooltip>
          {stats.allocations.failed > 0 && (
            <Tooltip title="Failed Allocations">
              <Chip
                size="small"
                icon={<Icon icon="mdi:alert" width={14} />}
                label={stats.allocations.failed}
                color="error"
              />
            </Tooltip>
          )}
        </>
      ) : (
        <Chip size="small" label="Disconnected" color="error" variant="outlined" />
      )}
    </Paper>
  );
}

export default function MultiClusterDashboard() {
  const theme = useTheme();
  const clusters = useTypedSelector(state => state.config.clusters) || {};
  const [clusterStats, setClusterStats] = useState<ClusterStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadAllStats = async () => {
      setLoading(true);
      const clusterEntries = Object.entries(clusters);

      const statsPromises = clusterEntries.map(([name, cluster]) =>
        fetchClusterStats(name, cluster?.server || '')
      );

      const stats = await Promise.all(statsPromises);

      if (mounted) {
        setClusterStats(stats);
        setLoading(false);
      }
    };

    loadAllStats();

    // Refresh every 30 seconds
    const interval = setInterval(loadAllStats, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [Object.keys(clusters).join(',')]);

  // Calculate aggregate stats
  const aggregate: AggregateStats = clusterStats.reduce(
    (acc, stats) => ({
      clusters: {
        total: acc.clusters.total + 1,
        connected: acc.clusters.connected + (stats.connected ? 1 : 0),
        disconnected: acc.clusters.disconnected + (stats.connected ? 0 : 1),
      },
      nodes: {
        total: acc.nodes.total + stats.nodes.total,
        ready: acc.nodes.ready + stats.nodes.ready,
        down: acc.nodes.down + stats.nodes.down,
      },
      jobs: {
        total: acc.jobs.total + stats.jobs.total,
        running: acc.jobs.running + stats.jobs.running,
        pending: acc.jobs.pending + stats.jobs.pending,
        dead: acc.jobs.dead + stats.jobs.dead,
      },
      allocations: {
        total: acc.allocations.total + stats.allocations.total,
        running: acc.allocations.running + stats.allocations.running,
        pending: acc.allocations.pending + stats.allocations.pending,
        failed: acc.allocations.failed + stats.allocations.failed,
      },
    }),
    {
      clusters: { total: 0, connected: 0, disconnected: 0 },
      nodes: { total: 0, ready: 0, down: 0 },
      jobs: { total: 0, running: 0, pending: 0, dead: 0 },
      allocations: { total: 0, running: 0, pending: 0, failed: 0 },
    }
  );

  const clusterCount = Object.keys(clusters).length;

  if (clusterCount === 0) {
    return null; // Will be handled by parent
  }

  return (
    <Box sx={{ mb: 4 }}>
      {/* Aggregate Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            title="Clusters"
            icon="mdi:hexagon-multiple"
            total={aggregate.clusters.total}
            loading={loading}
            breakdown={[
              { label: 'connected', value: aggregate.clusters.connected, color: theme.palette.success.main },
              { label: 'disconnected', value: aggregate.clusters.disconnected, color: theme.palette.error.main },
            ].filter(b => b.value > 0)}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            title="Total Nodes"
            icon="mdi:server"
            total={aggregate.nodes.total}
            loading={loading}
            breakdown={[
              { label: 'ready', value: aggregate.nodes.ready, color: theme.palette.success.main },
              { label: 'down', value: aggregate.nodes.down, color: theme.palette.error.main },
            ].filter(b => b.value > 0)}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            title="Total Jobs"
            icon="mdi:briefcase-outline"
            total={aggregate.jobs.total}
            loading={loading}
            breakdown={[
              { label: 'running', value: aggregate.jobs.running, color: theme.palette.success.main },
              { label: 'pending', value: aggregate.jobs.pending, color: theme.palette.warning.main },
              { label: 'dead', value: aggregate.jobs.dead, color: theme.palette.error.main },
            ].filter(b => b.value > 0)}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            title="Total Allocations"
            icon="mdi:cube-outline"
            total={aggregate.allocations.total}
            loading={loading}
            breakdown={[
              { label: 'running', value: aggregate.allocations.running, color: theme.palette.success.main },
              { label: 'pending', value: aggregate.allocations.pending, color: theme.palette.warning.main },
              { label: 'failed', value: aggregate.allocations.failed, color: theme.palette.error.main },
            ].filter(b => b.value > 0)}
          />
        </Grid>
      </Grid>

      {/* Cluster List */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
        CLUSTERS BY STATUS
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {loading
          ? Array.from({ length: clusterCount }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={72} />
            ))
          : clusterStats
              .sort((a, b) => {
                // Sort: disconnected first, then by issues, then by name
                if (a.connected !== b.connected) return a.connected ? 1 : -1;
                const aIssues = a.nodes.down + a.allocations.failed;
                const bIssues = b.nodes.down + b.allocations.failed;
                if (aIssues !== bIssues) return bIssues - aIssues;
                return a.name.localeCompare(b.name);
              })
              .map(stats => <ClusterRow key={stats.name} stats={stats} />)}
      </Box>
    </Box>
  );
}
