import React, { useEffect, useState, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Grid,
  IconButton,
  Link,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import WorkIcon from '@mui/icons-material/Work';
import StorageIcon from '@mui/icons-material/Storage';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { listJobs, listNodes, listAllocations } from '../../../lib/nomad/api';
import { JobListStub, NodeListStub, AllocationListStub } from '../../../lib/nomad/types';
import { SectionBox, SimpleTable, Loader } from '../../common';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { StatusChip } from '../statusStyles';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color?: string;
  subtitle?: string;
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: color || 'primary.main',
              color: 'white',
              display: 'flex',
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h4" component="div">
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function ClusterOverview() {
  
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
    return <Loader title="Loading cluster overview..." />;
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Error loading cluster data: {error.message}</Typography>
      </Box>
    );
  }

  // Calculate stats
  const runningJobs = jobs.filter((j) => j.Status === 'running').length;
  const pendingJobs = jobs.filter((j) => j.Status === 'pending').length;
  const deadJobs = jobs.filter((j) => j.Status === 'dead').length;

  const readyNodes = nodes.filter((n) => n.Status === 'ready').length;
  const downNodes = nodes.filter((n) => n.Status !== 'ready').length;

  const runningAllocs = allocations.filter((a) => a.ClientStatus === 'running').length;
  const pendingAllocs = allocations.filter((a) => a.ClientStatus === 'pending').length;
  const failedAllocs = allocations.filter((a) => ['failed', 'lost'].includes(a.ClientStatus)).length;

  // Recent jobs (last 5)
  const recentJobs = [...jobs]
    .sort((a, b) => (b.SubmitTime || 0) - (a.SubmitTime || 0))
    .slice(0, 5);

  // Recent allocations (last 5)
  const recentAllocations = [...allocations]
    .sort((a, b) => (b.CreateTime || 0) - (a.CreateTime || 0))
    .slice(0, 5);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, p: 2 }}>
        <Typography variant="h4">Cluster Overview</Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={loadData}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3, px: 2 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Jobs"
            value={jobs.length}
            icon={<WorkIcon />}
            color="#1976d2"
            subtitle={`${runningJobs} running, ${pendingJobs} pending, ${deadJobs} dead`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Nodes"
            value={nodes.length}
            icon={<StorageIcon />}
            color="#388e3c"
            subtitle={`${readyNodes} ready, ${downNodes} down`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Allocations"
            value={allocations.length}
            icon={<AssignmentIcon />}
            color="#f57c00"
            subtitle={`${runningAllocs} running, ${pendingAllocs} pending, ${failedAllocs} failed`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ px: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionBox
            title="Recent Jobs"
            headerProps={{
              actions: [
                <Link
                  key="view-all"
                  component={RouterLink}
                  to={createRouteURL('nomadJobs')}
                  sx={{ textDecoration: 'none' }}
                >
                  View All
                </Link>,
              ],
            }}
          >
            <SimpleTable
              columns={[
                {
                  label: 'Name',
                  getter: (job: JobListStub) => (
                    <Link
                      component={RouterLink}
                      to={createRouteURL('nomadJob', {
                        name: job.ID,
                        namespace: job.Namespace,
                      })}
                    >
                      {job.Name}
                    </Link>
                  ),
                },
                {
                  label: 'Status',
                  getter: (job: JobListStub) => (
                    <StatusChip status={job.Status} />
                  ),
                },
                {
                  label: 'Submitted',
                  getter: (job: JobListStub) =>
                    job.SubmitTime ? (
                      <DateLabel date={new Date(job.SubmitTime / 1000000)} />
                    ) : (
                      '-'
                    ),
                },
              ]}
              data={recentJobs}
              emptyMessage="No jobs found"
            />
          </SectionBox>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <SectionBox
            title="Recent Allocations"
            headerProps={{
              actions: [
                <Link
                  key="view-all"
                  component={RouterLink}
                  to={createRouteURL('nomadAllocations')}
                  sx={{ textDecoration: 'none' }}
                >
                  View All
                </Link>,
              ],
            }}
          >
            <SimpleTable
              columns={[
                {
                  label: 'ID',
                  getter: (alloc: AllocationListStub) => (
                    <Link
                      component={RouterLink}
                      to={createRouteURL('nomadAllocation', { id: alloc.ID })}
                    >
                      {alloc.ID.substring(0, 8)}
                    </Link>
                  ),
                },
                {
                  label: 'Job',
                  getter: (alloc: AllocationListStub) => alloc.JobID,
                },
                {
                  label: 'Status',
                  getter: (alloc: AllocationListStub) => (
                    <StatusChip status={alloc.ClientStatus} />
                  ),
                },
              ]}
              data={recentAllocations}
              emptyMessage="No allocations found"
            />
          </SectionBox>
        </Grid>

        <Grid size={12}>
          <SectionBox
            title="Nodes"
            headerProps={{
              actions: [
                <Link
                  key="view-all"
                  component={RouterLink}
                  to={createRouteURL('nomadNodes')}
                  sx={{ textDecoration: 'none' }}
                >
                  View All
                </Link>,
              ],
            }}
          >
            <SimpleTable
              columns={[
                {
                  label: 'Name',
                  getter: (node: NodeListStub) => (
                    <Link
                      component={RouterLink}
                      to={createRouteURL('nomadNode', { id: node.ID })}
                    >
                      {node.Name}
                    </Link>
                  ),
                },
                {
                  label: 'Datacenter',
                  getter: (node: NodeListStub) => node.Datacenter,
                },
                {
                  label: 'Address',
                  getter: (node: NodeListStub) => node.Address,
                },
                {
                  label: 'Status',
                  getter: (node: NodeListStub) => (
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      <StatusChip status={node.Status} />
                      {node.Drain && (
                        <StatusChip status="draining" showIcon={false} />
                      )}
                      {node.SchedulingEligibility === 'ineligible' && (
                        <StatusChip status="ineligible" label="Ineligible" showIcon={false} />
                      )}
                    </Box>
                  ),
                },
                {
                  label: 'Resources',
                  getter: (node: NodeListStub) => {
                    const cpu = node.NodeResources?.Cpu?.CpuShares || 0;
                    const mem = node.NodeResources?.Memory?.MemoryMB || 0;
                    return `CPU: ${cpu} MHz, Mem: ${mem} MB`;
                  },
                },
              ]}
              data={nodes}
              emptyMessage="No nodes found"
            />
          </SectionBox>
        </Grid>
      </Grid>
    </>
  );
}
