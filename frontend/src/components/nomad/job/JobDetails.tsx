import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  alpha,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
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
import {
  getJob,
  getJobAllocations,
  deleteJob,
  scaleJob,
  listJobs,
  listDeployments,
} from '../../../lib/nomad/api';
import { Job, AllocationListStub, JobListStub, Deployment } from '../../../lib/nomad/types';
import { SimpleTable } from '../../common';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { StatusChip } from '../statusStyles';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// Simple JSON view component (plain text, no highlighting to avoid memory issues)
function JsonView({ json }: { json: string }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      component="pre"
      sx={{
        fontFamily: '"Fira Code", "JetBrains Mono", "SF Mono", Consolas, monospace',
        fontSize: '0.8rem',
        lineHeight: 1.5,
        p: 2,
        m: 0,
        overflow: 'auto',
        maxHeight: 600,
        backgroundColor: isDark ? '#1e1e1e' : '#f8f8f8',
        color: isDark ? '#d4d4d4' : '#333',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {json}
    </Box>
  );
}

// Get parent job ID from hierarchical job ID
function getParentJobId(jobId: string): string | null {
  const lastSlash = jobId.lastIndexOf('/');
  if (lastSlash === -1) return null;
  return jobId.substring(0, lastSlash);
}

// Get job hierarchy as array of IDs
function getJobHierarchy(jobId: string): string[] {
  const parts = jobId.split('/');
  const hierarchy: string[] = [];
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    hierarchy.push(current);
  }
  return hierarchy;
}

// Summary stat card
function StatCard({
  icon,
  label,
  value,
  color,
  subValue,
}: {
  icon: string;
  label: string;
  value: number | string;
  color: string;
  subValue?: string;
}) {
  const theme = useTheme();

  return (
    <Card
      elevation={0}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        height: '100%',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: color,
          boxShadow: `0 4px 12px ${alpha(color, 0.15)}`,
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              backgroundColor: alpha(color, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon={icon} width={20} color={color} />
          </Box>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            {label}
          </Typography>
        </Box>
        <Typography variant="h4" fontWeight={600}>
          {value}
        </Typography>
        {subValue && (
          <Typography variant="caption" color="text.secondary">
            {subValue}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

// Detail row component
function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box
        sx={{
          fontSize: '0.875rem',
          ...(mono ? { fontFamily: 'monospace', fontSize: '0.8rem' } : {}),
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

// Task group card
function TaskGroupCard({
  taskGroup,
  allocations,
  onScale,
}: {
  taskGroup: any;
  allocations: AllocationListStub[];
  onScale?: (count: number) => void;
}) {
  const theme = useTheme();
  const groupAllocs = allocations.filter(a => a.TaskGroup === taskGroup.Name);
  const running = groupAllocs.filter(a => a.ClientStatus === 'running').length;
  const pending = groupAllocs.filter(a => a.ClientStatus === 'pending').length;
  const failed = groupAllocs.filter(a => a.ClientStatus === 'failed').length;

  return (
    <Card
      elevation={0}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        mb: 2,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          backgroundColor: alpha(theme.palette.primary.main, 0.03),
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon="mdi:layers-triple" width={22} color={theme.palette.primary.main} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              {taskGroup.Name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {taskGroup.Tasks?.length || 0} task{(taskGroup.Tasks?.length || 0) !== 1 ? 's' : ''} ·
              Count: {taskGroup.Count}
            </Typography>
          </Box>
        </Box>

        {/* Allocation status pills */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {running > 0 && (
            <Chip
              size="small"
              icon={<Icon icon="mdi:check-circle" width={14} />}
              label={`${running} Running`}
              sx={{
                backgroundColor: alpha(theme.palette.success.main, 0.1),
                color: theme.palette.success.main,
                fontWeight: 500,
                fontSize: '0.7rem',
              }}
            />
          )}
          {pending > 0 && (
            <Chip
              size="small"
              icon={<Icon icon="mdi:clock-outline" width={14} />}
              label={`${pending} Pending`}
              sx={{
                backgroundColor: alpha(theme.palette.warning.main, 0.1),
                color: theme.palette.warning.main,
                fontWeight: 500,
                fontSize: '0.7rem',
              }}
            />
          )}
          {failed > 0 && (
            <Chip
              size="small"
              icon={<Icon icon="mdi:alert-circle" width={14} />}
              label={`${failed} Failed`}
              sx={{
                backgroundColor: alpha(theme.palette.error.main, 0.1),
                color: theme.palette.error.main,
                fontWeight: 500,
                fontSize: '0.7rem',
              }}
            />
          )}
        </Box>
      </Box>

      {/* Tasks */}
      <Box sx={{ p: 2 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={600}
          sx={{ display: 'block', mb: 1.5 }}
        >
          TASKS
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {taskGroup.Tasks?.map((task: any) => (
            <Box
              key={task.Name}
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                backgroundColor: alpha(theme.palette.background.default, 0.5),
                border: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Icon icon="mdi:cube-outline" width={18} color={theme.palette.text.secondary} />
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {task.Name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {task.Driver}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    CPU
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {task.Resources?.CPU || '—'} MHz
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Memory
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {task.Resources?.MemoryMB || '—'} MB
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Card>
  );
}

// Deployment progress card
function DeploymentCard({ deployment }: { deployment: Deployment }) {
  const theme = useTheme();
  const taskGroups = deployment.TaskGroups ? Object.entries(deployment.TaskGroups) : [];

  const statusColor =
    deployment.Status === 'successful'
      ? theme.palette.success.main
      : deployment.Status === 'running'
        ? theme.palette.info.main
        : deployment.Status === 'failed'
          ? theme.palette.error.main
          : theme.palette.warning.main;

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          backgroundColor: alpha(statusColor, 0.05),
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              backgroundColor: alpha(statusColor, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              icon={
                deployment.Status === 'successful'
                  ? 'mdi:check-circle'
                  : deployment.Status === 'running'
                    ? 'mdi:progress-clock'
                    : deployment.Status === 'failed'
                      ? 'mdi:alert-circle'
                      : 'mdi:pause-circle'
              }
              width={22}
              color={statusColor}
            />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Deployment v{deployment.JobVersion}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                color: 'text.secondary',
              }}
            >
              {deployment.ID.substring(0, 8)}
            </Typography>
          </Box>
        </Box>
        <StatusChip status={deployment.Status || 'unknown'} />
      </Box>

      {/* Progress */}
      <Box sx={{ p: 2 }}>
        {deployment.StatusDescription && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {deployment.StatusDescription}
          </Typography>
        )}

        {taskGroups.map(([name, state]: [string, any]) => {
          const total = state.DesiredTotal || 0;
          const healthy = state.HealthyAllocs || 0;
          const unhealthy = state.UnhealthyAllocs || 0;
          const percent = total > 0 ? Math.round((healthy / total) * 100) : 0;

          return (
            <Box key={name} sx={{ mb: 2, '&:last-child': { mb: 0 } }}>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
              >
                <Typography variant="body2" fontWeight={500}>
                  {name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <Typography variant="caption" color="success.main">
                    {healthy} healthy
                  </Typography>
                  {unhealthy > 0 && (
                    <Typography variant="caption" color="error.main">
                      {unhealthy} unhealthy
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    / {total}
                  </Typography>
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={percent}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: alpha(theme.palette.divider, 0.5),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    backgroundColor:
                      percent === 100
                        ? theme.palette.success.main
                        : unhealthy > 0
                          ? theme.palette.warning.main
                          : theme.palette.primary.main,
                  },
                }}
              />
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

export default function JobDetails() {
  const theme = useTheme();
  const navigate = useNavigate();
  const params = useParams<{ name: string; namespace: string }>();
  const name = params.name ? decodeURIComponent(params.name) : undefined;
  const namespace = params.namespace ? decodeURIComponent(params.namespace) : undefined;

  const [job, setJob] = useState<Job | null>(null);
  const [allocations, setAllocations] = useState<AllocationListStub[]>([]);
  const [childJobs, setChildJobs] = useState<JobListStub[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [metaExpanded, setMetaExpanded] = useState(false);

  useEffect(() => {
    loadJob();
  }, [name, namespace]);

  async function loadJob() {
    if (!name) return;

    try {
      setLoading(true);
      const [jobData, allocsData, allJobsData, deploymentsData] = await Promise.all([
        getJob(name, namespace),
        getJobAllocations(name, namespace),
        listJobs({ namespace: namespace || '*' }),
        listDeployments({ namespace: namespace || '*' }),
      ]);
      setJob(jobData);
      setAllocations(allocsData || []);

      const children = (allJobsData || []).filter(
        j => j.ParentID === name || getParentJobId(j.ID) === name
      );
      setChildJobs(children);

      const jobDeployments = (deploymentsData || []).filter(d => d.JobID === name);
      jobDeployments.sort((a, b) => (b.JobCreateIndex || 0) - (a.JobCreateIndex || 0));
      setDeployments(jobDeployments);

      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }

  const breadcrumbs = useMemo(() => {
    if (!job) return [];
    const hierarchy = getJobHierarchy(job.ID);
    return hierarchy.slice(0, -1).map(id => ({
      id,
      name: id.split('/').pop() || id,
    }));
  }, [job]);

  async function handleStopJob() {
    if (!name) return;
    try {
      setActionError(null);
      await deleteJob(name, false, namespace);
      setStopDialogOpen(false);
      loadJob();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function handlePurgeJob() {
    if (!name) return;
    try {
      setActionError(null);
      await deleteJob(name, true, namespace);
      setPurgeDialogOpen(false);
      navigate(createRouteURL('nomadJobs'));
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2, mb: 3 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Icon icon="mdi:alert-circle" width={48} color={theme.palette.error.main} />
        <Typography color="error" sx={{ mt: 2 }}>
          Error loading job: {error.message}
        </Typography>
        <Button onClick={loadJob} sx={{ mt: 2 }}>
          Retry
        </Button>
      </Box>
    );
  }

  if (!job) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">Job not found</Typography>
      </Box>
    );
  }

  const hasChildren = childJobs.length > 0;
  const runningAllocs = allocations.filter(a => a.ClientStatus === 'running').length;
  const pendingAllocs = allocations.filter(a => a.ClientStatus === 'pending').length;
  const failedAllocs = allocations.filter(a => a.ClientStatus === 'failed').length;

  const statusColor =
    job.Status === 'running'
      ? theme.palette.success.main
      : job.Status === 'pending'
        ? theme.palette.warning.main
        : theme.palette.error.main;

  const metaEntries = job.Meta ? Object.entries(job.Meta) : [];

  return (
    <Box>
      {/* Breadcrumbs */}
      {(breadcrumbs.length > 0 || job.ParentID) && (
        <Box sx={{ mb: 2 }}>
          <Breadcrumbs
            separator={<Icon icon="mdi:chevron-right" width={16} />}
            sx={{ fontSize: '0.875rem' }}
          >
            <Link
              component={RouterLink}
              to={createRouteURL('nomadJobs')}
              color="inherit"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <Icon icon="mdi:briefcase-outline" width={16} />
              Jobs
            </Link>
            {job.ParentID && !breadcrumbs.some(b => b.id === job.ParentID) && (
              <Link
                component={RouterLink}
                to={createRouteURL('nomadJob', { name: job.ParentID, namespace: job.Namespace })}
                color="inherit"
              >
                {job.ParentID.split('/').pop() || job.ParentID}
              </Link>
            )}
            {breadcrumbs.map(b => (
              <Link
                key={b.id}
                component={RouterLink}
                to={createRouteURL('nomadJob', { name: b.id, namespace: job.Namespace })}
                color="inherit"
              >
                {b.name}
              </Link>
            ))}
            <Typography color="text.primary" fontWeight={500}>
              {job.Name.split('/').pop() || job.Name}
            </Typography>
          </Breadcrumbs>
        </Box>
      )}

      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          background: `linear-gradient(135deg, ${alpha(statusColor, 0.03)} 0%, ${alpha(theme.palette.background.paper, 1)} 100%)`,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'flex-start' }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                backgroundColor: alpha(statusColor, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px solid ${alpha(statusColor, 0.3)}`,
              }}
            >
              <Icon
                icon={
                  job.Periodic
                    ? 'mdi:calendar-clock'
                    : job.ParameterizedJob
                      ? 'mdi:send'
                      : 'mdi:briefcase'
                }
                width={28}
                color={statusColor}
              />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                <Typography variant="h5" fontWeight={600}>
                  {job.Name.split('/').pop() || job.Name}
                </Typography>
                <StatusChip status={job.Status} />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
                <Chip label={job.Type} size="small" variant="outlined" />
                {job.Periodic && (
                  <Chip
                    size="small"
                    icon={<Icon icon="mdi:calendar-clock" width={14} />}
                    label="Periodic"
                    color="info"
                    variant="outlined"
                  />
                )}
                {job.ParameterizedJob && (
                  <Chip
                    size="small"
                    icon={<Icon icon="mdi:send" width={14} />}
                    label="Parameterized"
                    color="secondary"
                    variant="outlined"
                  />
                )}
                {hasChildren && (
                  <Chip
                    size="small"
                    icon={<Icon icon="mdi:file-tree" width={14} />}
                    label={`${childJobs.length} children`}
                    color="info"
                    variant="outlined"
                  />
                )}
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <Icon icon="mdi:folder-outline" width={16} />
                  {job.Namespace}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    color: 'text.disabled',
                    backgroundColor: alpha(theme.palette.text.primary, 0.05),
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                  }}
                >
                  v{job.Version}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={loadJob} size="small">
                <Icon icon="mdi:refresh" width={20} />
              </IconButton>
            </Tooltip>
            {job.Status !== 'dead' && (
              <Button
                onClick={() => setStopDialogOpen(true)}
                variant="outlined"
                size="small"
                color="warning"
                startIcon={<Icon icon="mdi:stop" width={18} />}
              >
                Stop
              </Button>
            )}
            <Button
              onClick={() => setPurgeDialogOpen(true)}
              variant="outlined"
              size="small"
              color="error"
              startIcon={<Icon icon="mdi:delete" width={18} />}
            >
              Purge
            </Button>
          </Box>
        </Box>

        {actionError && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 1,
              backgroundColor: alpha(theme.palette.error.main, 0.1),
            }}
          >
            <Typography color="error" variant="body2">
              {actionError}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Summary stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            icon="mdi:layers-triple"
            label="Task Groups"
            value={job.TaskGroups?.length || 0}
            color={theme.palette.primary.main}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            icon="mdi:check-circle"
            label="Running"
            value={runningAllocs}
            color={theme.palette.success.main}
            subValue={`of ${allocations.length} allocations`}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            icon="mdi:clock-outline"
            label="Pending"
            value={pendingAllocs}
            color={theme.palette.warning.main}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            icon="mdi:alert-circle"
            label="Failed"
            value={failedAllocs}
            color={theme.palette.error.main}
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab
            label="Overview"
            icon={<Icon icon="mdi:view-dashboard-outline" width={18} />}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
          <Tab
            label="Task Groups"
            icon={<Icon icon="mdi:layers-triple" width={18} />}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
          <Tab
            label={`Allocations (${allocations.length})`}
            icon={<Icon icon="mdi:cube-outline" width={18} />}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
          {hasChildren && (
            <Tab
              label={`Children (${childJobs.length})`}
              icon={<Icon icon="mdi:file-tree" width={18} />}
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
          )}
          <Tab
            label="Definition"
            icon={<Icon icon="mdi:code-json" width={18} />}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {/* Details */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
              DETAILS
            </Typography>
            <Paper
              elevation={0}
              sx={{ p: 2.5, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}
            >
              <DetailRow label="ID" value={job.ID} mono />
              <DetailRow label="Name" value={job.Name} />
              <DetailRow label="Namespace" value={job.Namespace} />
              <DetailRow label="Type" value={<Chip size="small" label={job.Type} />} />
              <DetailRow label="Status" value={<StatusChip status={job.Status} />} />
              <DetailRow label="Priority" value={job.Priority} />
              <DetailRow label="Datacenters" value={job.Datacenters?.join(', ') || '—'} />
              <DetailRow label="Version" value={job.Version} />
              <DetailRow
                label="Stable"
                value={
                  <Chip
                    size="small"
                    label={job.Stable ? 'Yes' : 'No'}
                    color={job.Stable ? 'success' : 'default'}
                  />
                }
              />
              {job.ParentID && (
                <DetailRow
                  label="Parent Job"
                  value={
                    <Link
                      component={RouterLink}
                      to={createRouteURL('nomadJob', {
                        name: job.ParentID,
                        namespace: job.Namespace,
                      })}
                    >
                      {job.ParentID}
                    </Link>
                  }
                />
              )}
              <DetailRow
                label="Submitted"
                value={
                  job.SubmitTime ? <DateLabel date={new Date(job.SubmitTime / 1000000)} /> : '—'
                }
              />
            </Paper>
          </Grid>

          {/* Deployment */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
              {deployments.length > 0 ? 'LATEST DEPLOYMENT' : 'DEPLOYMENT'}
            </Typography>
            {deployments.length > 0 ? (
              <>
                <DeploymentCard deployment={deployments[0]} />
                {deployments.length > 1 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    + {deployments.length - 1} previous deployment{deployments.length > 2 ? 's' : ''}
                  </Typography>
                )}
              </>
            ) : (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  textAlign: 'center',
                }}
              >
                <Icon icon="mdi:rocket-launch-outline" width={32} color={theme.palette.text.disabled} />
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  No deployments
                </Typography>
              </Paper>
            )}
          </Grid>

          {/* Periodic config */}
          {job.Periodic && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
                PERIODIC CONFIGURATION
              </Typography>
              <Paper
                elevation={0}
                sx={{ p: 2.5, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}
              >
                <DetailRow label="Enabled" value={job.Periodic.Enabled ? 'Yes' : 'No'} />
                <DetailRow label="Spec" value={job.Periodic.Spec || '—'} mono />
                <DetailRow label="Spec Type" value={job.Periodic.SpecType || 'cron'} />
                <DetailRow label="Prohibit Overlap" value={job.Periodic.ProhibitOverlap ? 'Yes' : 'No'} />
                <DetailRow label="Time Zone" value={job.Periodic.TimeZone || 'UTC'} />
              </Paper>
            </Grid>
          )}

          {/* Parameterized config */}
          {job.ParameterizedJob && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
                PARAMETERIZED CONFIGURATION
              </Typography>
              <Paper
                elevation={0}
                sx={{ p: 2.5, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}
              >
                <DetailRow label="Payload" value={job.ParameterizedJob.Payload || 'none'} />
                <DetailRow
                  label="Meta Required"
                  value={job.ParameterizedJob.MetaRequired?.join(', ') || '—'}
                />
                <DetailRow
                  label="Meta Optional"
                  value={job.ParameterizedJob.MetaOptional?.join(', ') || '—'}
                />
              </Paper>
            </Grid>
          )}

          {/* Metadata */}
          {metaEntries.length > 0 && (
            <Grid size={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  METADATA ({metaEntries.length})
                </Typography>
                <Button
                  size="small"
                  onClick={() => setMetaExpanded(!metaExpanded)}
                  endIcon={<Icon icon={metaExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'} width={18} />}
                >
                  {metaExpanded ? 'Collapse' : 'Expand'}
                </Button>
              </Box>

              <Collapse in={metaExpanded}>
                <Paper
                  elevation={0}
                  sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}
                >
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                    {metaEntries.sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                      <Box
                        key={key}
                        sx={{
                          p: 2,
                          borderBottom: `1px solid ${theme.palette.divider}`,
                          borderRight: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          {key}
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                          {value || '—'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              </Collapse>

              {!metaExpanded && (
                <Paper
                  elevation={0}
                  sx={{ p: 2, borderRadius: 2, border: `1px solid ${theme.palette.divider}`, display: 'flex', flexWrap: 'wrap', gap: 1 }}
                >
                  {metaEntries.slice(0, 6).map(([key]) => (
                    <Chip key={key} size="small" label={key} sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                  ))}
                  {metaEntries.length > 6 && (
                    <Chip
                      size="small"
                      label={`+${metaEntries.length - 6} more`}
                      color="primary"
                      variant="outlined"
                      onClick={() => setMetaExpanded(true)}
                      sx={{ cursor: 'pointer' }}
                    />
                  )}
                </Paper>
              )}
            </Grid>
          )}
        </Grid>
      </TabPanel>

      {/* Task Groups Tab */}
      <TabPanel value={tabValue} index={1}>
        {job.TaskGroups?.map(taskGroup => (
          <TaskGroupCard key={taskGroup.Name} taskGroup={taskGroup} allocations={allocations} />
        ))}
      </TabPanel>

      {/* Allocations Tab */}
      <TabPanel value={tabValue} index={2}>
        <Paper
          elevation={0}
          sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}
        >
          {allocations.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Icon icon="mdi:cube-off-outline" width={48} color={theme.palette.text.disabled} />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                No allocations
              </Typography>
            </Box>
          ) : (
            <SimpleTable
              columns={[
                {
                  label: 'ID',
                  getter: (alloc: AllocationListStub) => (
                    <Link
                      component={RouterLink}
                      to={createRouteURL('nomadAllocation', { id: alloc.ID })}
                      sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                    >
                      {alloc.ID.substring(0, 8)}
                    </Link>
                  ),
                },
                { label: 'Task Group', getter: (alloc: AllocationListStub) => alloc.TaskGroup },
                {
                  label: 'Node',
                  getter: (alloc: AllocationListStub) => (
                    <Link component={RouterLink} to={createRouteURL('nomadNode', { id: alloc.NodeID })}>
                      {alloc.NodeName}
                    </Link>
                  ),
                },
                {
                  label: 'Status',
                  getter: (alloc: AllocationListStub) => <StatusChip status={alloc.ClientStatus} />,
                },
                {
                  label: 'Created',
                  getter: (alloc: AllocationListStub) => (
                    <DateLabel date={new Date(alloc.CreateTime / 1000000)} />
                  ),
                },
              ]}
              data={allocations}
            />
          )}
        </Paper>
      </TabPanel>

      {/* Child Jobs Tab */}
      {hasChildren && (
        <TabPanel value={tabValue} index={3}>
          <Paper
            elevation={0}
            sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}
          >
            <SimpleTable
              columns={[
                {
                  label: 'Name',
                  getter: (child: JobListStub) => (
                    <Link
                      component={RouterLink}
                      to={createRouteURL('nomadJob', { name: child.ID, namespace: child.Namespace })}
                    >
                      {child.ID.split('/').pop() || child.Name}
                    </Link>
                  ),
                },
                {
                  label: 'Type',
                  getter: (child: JobListStub) => <Chip label={child.Type} size="small" variant="outlined" />,
                },
                {
                  label: 'Status',
                  getter: (child: JobListStub) => <StatusChip status={child.Status} />,
                },
                {
                  label: 'Submitted',
                  getter: (child: JobListStub) =>
                    child.SubmitTime ? <DateLabel date={new Date(child.SubmitTime / 1000000)} /> : '—',
                },
              ]}
              data={childJobs.sort((a, b) => (b.SubmitTime || 0) - (a.SubmitTime || 0))}
            />
          </Paper>
        </TabPanel>
      )}

      {/* Definition Tab */}
      <TabPanel value={tabValue} index={hasChildren ? 4 : 3}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              p: 2,
              backgroundColor: alpha(theme.palette.background.default, 0.5),
              borderBottom: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              Job Definition (JSON)
            </Typography>
            <Tooltip title="Copy to clipboard">
              <IconButton
                size="small"
                onClick={() => navigator.clipboard.writeText(JSON.stringify(job, null, 2))}
              >
                <Icon icon="mdi:content-copy" width={18} />
              </IconButton>
            </Tooltip>
          </Box>
          <JsonView json={JSON.stringify(job, null, 2)} />
        </Paper>
      </TabPanel>

      {/* Dialogs */}
      <Dialog open={stopDialogOpen} onClose={() => setStopDialogOpen(false)}>
        <DialogTitle>Stop Job</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to stop the job "{job.Name}"? This will stop all running
            allocations but keep the job definition.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStopDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleStopJob} color="warning" variant="contained">
            Stop
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={purgeDialogOpen} onClose={() => setPurgeDialogOpen(false)}>
        <DialogTitle>Purge Job</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to purge the job "{job.Name}"? This will permanently delete
            the job and all its history. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPurgeDialogOpen(false)}>Cancel</Button>
          <Button onClick={handlePurgeJob} color="error" variant="contained">
            Purge
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
