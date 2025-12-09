import React, { useEffect, useState, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  alpha,
  Box,
  IconButton,
  Link,
  Paper,
  Skeleton,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { listJobs, listNodes, listAllocations } from '../../../lib/nomad/api';
import { JobListStub, NodeListStub, AllocationListStub } from '../../../lib/nomad/types';
import { SimpleTable } from '../../common';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { MinimalStatus, minimalStatusColors } from '../statusStyles';

// Compact stat item
function StatItem({
  label,
  value,
  color,
  subValues,
}: {
  label: string;
  value: number;
  color: string;
  subValues?: { label: string; value: number; color?: string }[];
}) {
  const theme = useTheme();
  return (
    <Box sx={{ minWidth: 120 }}>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'block',
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '1.5rem',
          fontWeight: 600,
          color: color,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
      {subValues && subValues.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
          {subValues.map((sv, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
              <Typography variant="caption" sx={{ color: sv.color || 'text.secondary', fontWeight: 500, fontSize: '0.7rem' }}>
                {sv.value}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem' }}>
                {sv.label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default function ClusterOverview() {
  const theme = useTheme();
  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;

  const [jobs, setJobs] = useState<JobListStub[]>([]);
  const [nodes, setNodes] = useState<NodeListStub[]>([]);
  const [allocations, setAllocations] = useState<AllocationListStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [jobsData, nodesData, allocsData] = await Promise.all([
        listJobs({ namespace: '*' }),
        listNodes(),
        listAllocations({ namespace: '*' }),
      ]);
      setJobs(jobsData || []);
      setNodes(nodesData || []);
      setAllocations(allocsData || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1, mb: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error" variant="body2">Error: {error.message}</Typography>
      </Box>
    );
  }

  // Calculate stats
  const runningJobs = jobs.filter(j => j.Status === 'running').length;
  const pendingJobs = jobs.filter(j => j.Status === 'pending').length;
  const deadJobs = jobs.filter(j => j.Status === 'dead').length;

  const readyNodes = nodes.filter(n => n.Status === 'ready').length;
  const downNodes = nodes.filter(n => n.Status !== 'ready').length;

  const runningAllocs = allocations.filter(a => a.ClientStatus === 'running').length;
  const pendingAllocs = allocations.filter(a => a.ClientStatus === 'pending').length;
  const failedAllocs = allocations.filter(a => ['failed', 'lost'].includes(a.ClientStatus)).length;

  // Recent data
  const recentJobs = [...jobs].sort((a, b) => (b.SubmitTime || 0) - (a.SubmitTime || 0)).slice(0, 5);
  const recentAllocations = [...allocations].sort((a, b) => (b.CreateTime || 0) - (a.CreateTime || 0)).slice(0, 5);

  return (
    <Box sx={{ pb: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          pb: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
          Cluster Overview
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={loadData} size="small" sx={{ p: 0.75 }}>
            <Icon icon="mdi:refresh" width={18} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Compact Stats Bar */}
      <Box
        sx={{
          display: 'flex',
          gap: 5,
          mb: 3,
          pb: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <StatItem
          label="Jobs"
          value={jobs.length}
          color={theme.palette.primary.main}
          subValues={[
            { label: 'running', value: runningJobs, color: colors.success },
            { label: 'pending', value: pendingJobs, color: colors.pending },
            { label: 'dead', value: deadJobs },
          ]}
        />
        <StatItem
          label="Nodes"
          value={nodes.length}
          color={colors.success}
          subValues={[
            { label: 'ready', value: readyNodes, color: colors.success },
            { label: 'down', value: downNodes, color: downNodes > 0 ? colors.error : undefined },
          ]}
        />
        <StatItem
          label="Allocations"
          value={allocations.length}
          color={theme.palette.warning.main}
          subValues={[
            { label: 'running', value: runningAllocs, color: colors.success },
            { label: 'pending', value: pendingAllocs, color: colors.pending },
            { label: 'failed', value: failedAllocs, color: failedAllocs > 0 ? colors.error : undefined },
          ]}
        />
      </Box>

      {/* Two column layout */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* Recent Jobs */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Jobs
            </Typography>
            <Link component={RouterLink} to={createRouteURL('nomadJobs')} sx={{ fontSize: '0.7rem' }}>
              View All
            </Link>
          </Box>
          <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
            <SimpleTable
              columns={[
                {
                  label: 'Name',
                  getter: (job: JobListStub) => (
                    <Link component={RouterLink} to={createRouteURL('nomadJob', { name: job.ID, namespace: job.Namespace })} sx={{ fontSize: '0.8rem' }}>
                      {job.Name}
                    </Link>
                  ),
                },
                {
                  label: 'Status',
                  getter: (job: JobListStub) => <MinimalStatus status={job.Status} />,
                },
                {
                  label: 'Submitted',
                  getter: (job: JobListStub) => job.SubmitTime ? <DateLabel date={new Date(job.SubmitTime / 1000000)} format="mini" /> : '—',
                },
              ]}
              data={recentJobs}
              emptyMessage="No jobs"
            />
          </Paper>
        </Box>

        {/* Recent Allocations */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Allocations
            </Typography>
          </Box>
          <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
            <SimpleTable
              columns={[
                {
                  label: 'ID',
                  getter: (alloc: AllocationListStub) => (
                    <Link component={RouterLink} to={createRouteURL('nomadAllocation', { id: alloc.ID })} sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {alloc.ID.substring(0, 8)}
                    </Link>
                  ),
                },
                {
                  label: 'Job',
                  getter: (alloc: AllocationListStub) => (
                    <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>{alloc.JobID}</Typography>
                  ),
                },
                {
                  label: 'Status',
                  getter: (alloc: AllocationListStub) => <MinimalStatus status={alloc.ClientStatus} />,
                },
              ]}
              data={recentAllocations}
              emptyMessage="No allocations"
            />
          </Paper>
        </Box>
      </Box>

      {/* Nodes Table */}
      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Nodes
          </Typography>
          <Link component={RouterLink} to={createRouteURL('nomadNodes')} sx={{ fontSize: '0.7rem' }}>
            View All
          </Link>
        </Box>
        <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
          <SimpleTable
            columns={[
              {
                label: 'Name',
                getter: (node: NodeListStub) => (
                  <Link component={RouterLink} to={createRouteURL('nomadNode', { id: node.ID })} sx={{ fontSize: '0.8rem' }}>
                    {node.Name}
                  </Link>
                ),
              },
              { label: 'Datacenter', getter: (node: NodeListStub) => node.Datacenter },
              {
                label: 'Address',
                getter: (node: NodeListStub) => (
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{node.Address}</Typography>
                ),
              },
              {
                label: 'Status',
                getter: (node: NodeListStub) => (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <MinimalStatus status={node.Status} />
                    {node.Drain && <Typography variant="caption" sx={{ color: colors.pending, fontSize: '0.65rem' }}>draining</Typography>}
                    {node.SchedulingEligibility === 'ineligible' && <Typography variant="caption" sx={{ color: colors.error, fontSize: '0.65rem' }}>ineligible</Typography>}
                  </Box>
                ),
              },
              {
                label: 'Resources',
                getter: (node: NodeListStub) => {
                  const cpu = node.NodeResources?.Cpu?.CpuShares || 0;
                  const mem = node.NodeResources?.Memory?.MemoryMB || 0;
                  return (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.65rem' }}>
                      {cpu} MHz · {mem} MB
                    </Typography>
                  );
                },
              },
            ]}
            data={nodes}
            emptyMessage="No nodes"
          />
        </Paper>
      </Box>
    </Box>
  );
}
