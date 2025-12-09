import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  alpha,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
  listJobs,
  listDeployments,
  getJobEvaluations,
} from '../../../lib/nomad/api';
import { Job, AllocationListStub, JobListStub, Deployment, Evaluation } from '../../../lib/nomad/types';
import { SimpleTable } from '../../common';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { MinimalStatus, minimalStatusColors, getStatusCategory } from '../statusStyles';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

// Compact JSON viewer
function JsonView({ json }: { json: string }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      component="pre"
      sx={{
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: '0.75rem',
        lineHeight: 1.6,
        p: 2,
        m: 0,
        overflow: 'auto',
        maxHeight: 600,
        backgroundColor: isDark ? '#0d0d0d' : '#fafafa',
        color: isDark ? '#e0e0e0' : '#1a1a1a',
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

// Compact stat item (inline, not card)
function StatItem({
  label,
  value,
  color,
  subValue,
}: {
  label: string;
  value: number | string;
  color?: string;
  subValue?: string;
}) {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 80 }}>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '1.25rem',
          fontWeight: 600,
          color: color || 'text.primary',
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
      {subValue && (
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
          {subValue}
        </Typography>
      )}
    </Box>
  );
}

// Compact detail row
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
        py: 0.75,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
        {label}
      </Typography>
      <Box
        sx={{
          fontSize: '0.75rem',
          ...(mono ? { fontFamily: 'monospace', fontSize: '0.7rem' } : {}),
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

// Compact task group row (table-like)
function TaskGroupRow({
  taskGroup,
  allocations,
  namespace,
  jobId,
}: {
  taskGroup: any;
  allocations: AllocationListStub[];
  namespace: string;
  jobId: string;
}) {
  const theme = useTheme();
  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;
  const [expanded, setExpanded] = useState(false);

  const groupAllocs = allocations.filter(a => a.TaskGroup === taskGroup.Name);
  const running = groupAllocs.filter(a => a.ClientStatus === 'running').length;
  const pending = groupAllocs.filter(a => a.ClientStatus === 'pending').length;
  const failed = groupAllocs.filter(a => a.ClientStatus === 'failed').length;

  const totalCpu = taskGroup.Tasks?.reduce((sum: number, t: any) => sum + (t.Resources?.CPU || 0), 0) || 0;
  const totalMem = taskGroup.Tasks?.reduce((sum: number, t: any) => sum + (t.Resources?.MemoryMB || 0), 0) || 0;

  return (
    <Box sx={{ borderBottom: `1px solid ${theme.palette.divider}`, '&:last-child': { borderBottom: 'none' } }}>
      {/* Main row */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'grid',
          gridTemplateColumns: '24px 1fr 100px 140px 100px 80px',
          alignItems: 'center',
          gap: 2,
          py: 1,
          px: 1.5,
          cursor: 'pointer',
          transition: 'background-color 0.15s',
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.03),
          },
        }}
      >
        <Icon
          icon={expanded ? 'mdi:chevron-down' : 'mdi:chevron-right'}
          width={16}
          color={theme.palette.text.secondary}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={500} noWrap>
            {taskGroup.Name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>
            {taskGroup.Tasks?.length || 0} task{(taskGroup.Tasks?.length || 0) !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
          ×{taskGroup.Count}
        </Typography>
        {/* Allocation counts */}
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
          {running > 0 && (
            <Typography variant="body2" sx={{ color: colors.success, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
              {running}
            </Typography>
          )}
          {pending > 0 && (
            <Typography variant="body2" sx={{ color: colors.pending, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
              {pending}
            </Typography>
          )}
          {failed > 0 && (
            <Typography variant="body2" sx={{ color: colors.error, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
              {failed}
            </Typography>
          )}
          {running === 0 && pending === 0 && failed === 0 && (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
          )}
        </Box>
        {/* Resources */}
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.7rem', textAlign: 'right' }}>
          {totalCpu} MHz
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.7rem', textAlign: 'right' }}>
          {totalMem} MB
        </Typography>
      </Box>

      {/* Expanded tasks */}
      <Collapse in={expanded}>
        <Box sx={{ backgroundColor: alpha(theme.palette.background.default, 0.5), py: 0.5 }}>
          {taskGroup.Tasks?.map((task: any) => (
            <Box
              key={task.Name}
              sx={{
                display: 'grid',
                gridTemplateColumns: '24px 1fr 100px 140px 100px 80px',
                alignItems: 'center',
                gap: 2,
                py: 0.5,
                px: 1.5,
              }}
            >
              <Box />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 2 }}>
                <Icon icon="mdi:cube-outline" width={14} color={theme.palette.text.disabled} />
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                  {task.Name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.disabled',
                    fontSize: '0.65rem',
                    backgroundColor: alpha(theme.palette.text.primary, 0.05),
                    px: 0.75,
                    py: 0.125,
                    borderRadius: 0.5,
                  }}
                >
                  {task.Driver}
                </Typography>
              </Box>
              <Box />
              <Box />
              <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', fontSize: '0.65rem', textAlign: 'right' }}>
                {task.Resources?.CPU || '—'} MHz
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', fontSize: '0.65rem', textAlign: 'right' }}>
                {task.Resources?.MemoryMB || '—'} MB
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

// Placement failures component
interface PlacementFailure {
  taskGroup: string;
  unplacedCount: number;
  constraints: { constraint: string; count: number }[];
  classFiltered: { className: string; count: number }[];
  nodesEvaluated: number;
  nodesFiltered: number;
  nodesExhausted: number;
  dimensionExhausted: { dimension: string; count: number }[];
}

function PlacementFailuresAlert({
  failures,
}: {
  failures: PlacementFailure[];
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (failures.length === 0) return null;

  const totalUnplaced = failures.reduce((sum, f) => sum + f.unplacedCount, 0);

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        borderRadius: 1,
        border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
        backgroundColor: alpha(theme.palette.error.main, 0.03),
        overflow: 'hidden',
      }}
    >
      {/* Compact header - clickable */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          px: 1.5,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          '&:hover': { backgroundColor: alpha(theme.palette.error.main, 0.05) },
        }}
      >
        <Icon icon={expanded ? 'mdi:chevron-down' : 'mdi:chevron-right'} width={16} color={theme.palette.error.main} />
        <Icon icon="mdi:alert-circle" width={16} color={theme.palette.error.main} />
        <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 500, fontSize: '0.8rem' }}>
          {totalUnplaced} placement failure{totalUnplaced !== 1 ? 's' : ''}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
          {failures.map(f => f.taskGroup).join(', ')}
        </Typography>
      </Box>

      {/* Expanded details */}
      <Collapse in={expanded}>
        <Box sx={{ borderTop: `1px solid ${alpha(theme.palette.error.main, 0.15)}` }}>
          {failures.map((failure, idx) => (
            <Box
              key={failure.taskGroup}
              sx={{
                px: 1.5,
                py: 1,
                borderBottom: idx < failures.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
              }}
            >
              {/* Task group header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.8rem' }}>
                  {failure.taskGroup}
                </Typography>
                <Typography variant="caption" sx={{ color: 'error.main', fontSize: '0.7rem' }}>
                  {failure.unplacedCount} unplaced
                </Typography>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                    {failure.nodesEvaluated} evaluated
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                    {failure.nodesFiltered} filtered
                  </Typography>
                </Box>
              </Box>

              {/* Constraint failures */}
              {failure.constraints.length > 0 && (
                <Box sx={{ pl: 1.5 }}>
                  {failure.constraints.map((c, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, py: 0.25 }}>
                      <Icon icon="mdi:filter-off" width={12} color={theme.palette.warning.main} style={{ marginTop: 2 }} />
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: 'monospace', fontSize: '0.7rem', wordBreak: 'break-all' }}
                      >
                        {c.constraint}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', flexShrink: 0 }}>
                        ({c.count} node{c.count !== 1 ? 's' : ''})
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Resource exhaustion */}
              {failure.dimensionExhausted.length > 0 && (
                <Box sx={{ pl: 1.5, mt: 0.5 }}>
                  {failure.dimensionExhausted.map((d, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
                      <Icon
                        icon={d.dimension.toLowerCase().includes('cpu') ? 'mdi:chip' : 'mdi:memory'}
                        width={12}
                        color={theme.palette.error.main}
                      />
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                        {d.dimension}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                        exhausted on {d.count} node{d.count !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
}

// Helper to extract placement failures from evaluations
function extractPlacementFailures(evaluations: Evaluation[]): PlacementFailure[] {
  const sortedEvals = [...evaluations].sort((a, b) => (b.ModifyIndex || 0) - (a.ModifyIndex || 0));
  
  // Only show placement failures from blocked evaluations (ongoing issues)
  // Completed evaluations with FailedTGAllocs are historical and no longer relevant
  const evalWithFailures = sortedEvals.find(
    e => e.Status === 'blocked' && e.FailedTGAllocs && Object.keys(e.FailedTGAllocs).length > 0
  );

  if (!evalWithFailures || !evalWithFailures.FailedTGAllocs) {
    return [];
  }

  const failures: PlacementFailure[] = [];

  for (const [taskGroup, metrics] of Object.entries(evalWithFailures.FailedTGAllocs)) {
    const constraints: { constraint: string; count: number }[] = [];
    const classFiltered: { className: string; count: number }[] = [];
    const dimensionExhausted: { dimension: string; count: number }[] = [];

    if (metrics.ConstraintFiltered) {
      for (const [constraint, count] of Object.entries(metrics.ConstraintFiltered)) {
        constraints.push({ constraint, count });
      }
    }

    if (metrics.ClassFiltered) {
      for (const [className, count] of Object.entries(metrics.ClassFiltered)) {
        classFiltered.push({ className, count });
      }
    }

    if (metrics.DimensionExhausted) {
      for (const [dimension, count] of Object.entries(metrics.DimensionExhausted)) {
        dimensionExhausted.push({ dimension, count });
      }
    }

    const hasFailures = constraints.length > 0 || classFiltered.length > 0 || dimensionExhausted.length > 0 || metrics.NodesExhausted > 0;
    if (hasFailures) {
      failures.push({
        taskGroup,
        unplacedCount: (metrics.CoalescedFailures || 0) + 1,
        constraints,
        classFiltered,
        nodesEvaluated: metrics.NodesEvaluated || 0,
        nodesFiltered: metrics.NodesFiltered || 0,
        nodesExhausted: metrics.NodesExhausted || 0,
        dimensionExhausted,
      });
    }
  }

  return failures;
}

// Compact deployment progress
function DeploymentProgress({ deployment }: { deployment: Deployment }) {
  const theme = useTheme();
  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;
  const taskGroups = deployment.TaskGroups ? Object.entries(deployment.TaskGroups) : [];

  const statusColor =
    deployment.Status === 'successful' ? colors.success
    : deployment.Status === 'running' ? colors.pending
    : deployment.Status === 'failed' ? colors.error
    : colors.cancelled;

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <MinimalStatus status={deployment.Status || 'unknown'} />
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.65rem' }}>
          v{deployment.JobVersion} · {deployment.ID.substring(0, 8)}
        </Typography>
      </Box>

      {taskGroups.map(([name, state]: [string, any]) => {
        const total = state.DesiredTotal || 0;
        const healthy = state.HealthyAllocs || 0;
        const unhealthy = state.UnhealthyAllocs || 0;
        const percent = total > 0 ? Math.round((healthy / total) * 100) : 0;

        return (
          <Box key={name} sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                {name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                {healthy}/{total} healthy
                {unhealthy > 0 && <span style={{ color: colors.error, marginLeft: 8 }}>{unhealthy} unhealthy</span>}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={percent}
              sx={{
                height: 4,
                borderRadius: 2,
                backgroundColor: alpha(theme.palette.divider, 0.5),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 2,
                  backgroundColor: percent === 100 ? colors.success : unhealthy > 0 ? colors.error : colors.pending,
                },
              }}
            />
          </Box>
        );
      })}
    </Box>
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
  const [placementFailures, setPlacementFailures] = useState<PlacementFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [metaExpanded, setMetaExpanded] = useState(false);

  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;

  useEffect(() => {
    loadJob();
  }, [name, namespace]);

  async function loadJob() {
    if (!name) return;

    try {
      setLoading(true);
      const [jobData, allocsData, allJobsData, deploymentsData, evaluationsData] = await Promise.all([
        getJob(name, namespace),
        getJobAllocations(name, namespace),
        listJobs({ namespace: namespace || '*' }),
        listDeployments({ namespace: namespace || '*' }),
        getJobEvaluations(name, namespace),
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

      const failures = extractPlacementFailures(evaluationsData || []);
      setPlacementFailures(failures);

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
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1, mb: 2 }} />
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Icon icon="mdi:alert-circle" width={36} color={theme.palette.error.main} />
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          {error.message}
        </Typography>
        <Button onClick={loadJob} size="small" sx={{ mt: 1 }}>
          Retry
        </Button>
      </Box>
    );
  }

  if (!job) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">Job not found</Typography>
      </Box>
    );
  }

  const hasChildren = childJobs.length > 0;
  const runningAllocs = allocations.filter(a => a.ClientStatus === 'running').length;
  const pendingAllocs = allocations.filter(a => a.ClientStatus === 'pending').length;
  const failedAllocs = allocations.filter(a => a.ClientStatus === 'failed').length;

  const statusCategory = getStatusCategory(job.Status);
  const statusColor = colors[statusCategory];

  const metaEntries = job.Meta ? Object.entries(job.Meta) : [];

  return (
    <Box sx={{ pb: 3 }}>
      {/* Breadcrumbs - compact */}
      {(breadcrumbs.length > 0 || job.ParentID) && (
        <Box sx={{ mb: 1.5 }}>
          <Breadcrumbs
            separator={<Icon icon="mdi:chevron-right" width={14} />}
            sx={{ fontSize: '0.75rem' }}
          >
            <Link
              component={RouterLink}
              to={createRouteURL('nomadJobs')}
              color="inherit"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.75rem' }}
            >
              Jobs
            </Link>
            {job.ParentID && !breadcrumbs.some(b => b.id === job.ParentID) && (
              <Link
                component={RouterLink}
                to={createRouteURL('nomadJob', { name: job.ParentID, namespace: job.Namespace })}
                color="inherit"
                sx={{ fontSize: '0.75rem' }}
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
                sx={{ fontSize: '0.75rem' }}
              >
                {b.name}
              </Link>
            ))}
          </Breadcrumbs>
        </Box>
      )}

      {/* Compact Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 2,
          pb: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
              {job.Name.split('/').pop() || job.Name}
            </Typography>
            <MinimalStatus status={job.Status} />
            <Typography
              variant="caption"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.65rem',
                color: 'text.disabled',
                backgroundColor: alpha(theme.palette.text.primary, 0.05),
                px: 0.75,
                py: 0.25,
                borderRadius: 0.5,
              }}
            >
              v{job.Version}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Icon icon="mdi:folder-outline" width={14} />
              {job.Namespace}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                backgroundColor: alpha(theme.palette.text.primary, 0.05),
                px: 0.75,
                py: 0.125,
                borderRadius: 0.5,
                fontSize: '0.7rem',
              }}
            >
              {job.Type}
            </Typography>
            {job.Periodic && (
              <Typography variant="caption" sx={{ color: 'info.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Icon icon="mdi:calendar-clock" width={14} />
                periodic
              </Typography>
            )}
            {job.ParameterizedJob && (
              <Typography variant="caption" sx={{ color: 'secondary.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Icon icon="mdi:send" width={14} />
                parameterized
              </Typography>
            )}
            {hasChildren && (
              <Typography variant="caption" sx={{ color: 'info.main' }}>
                {childJobs.length} children
              </Typography>
            )}
          </Box>
        </Box>

        {/* Actions - compact */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadJob} size="small" sx={{ p: 0.75 }}>
              <Icon icon="mdi:refresh" width={18} />
            </IconButton>
          </Tooltip>
          {job.Status !== 'dead' && (
            <Button
              onClick={() => setStopDialogOpen(true)}
              size="small"
              color="warning"
              sx={{ minWidth: 'auto', px: 1.5, py: 0.5, fontSize: '0.75rem' }}
            >
              Stop
            </Button>
          )}
          <Button
            onClick={() => setPurgeDialogOpen(true)}
            size="small"
            color="error"
            sx={{ minWidth: 'auto', px: 1.5, py: 0.5, fontSize: '0.75rem' }}
          >
            Purge
          </Button>
        </Box>
      </Box>

      {actionError && (
        <Box sx={{ mb: 2, p: 1, borderRadius: 1, backgroundColor: alpha(theme.palette.error.main, 0.1) }}>
          <Typography color="error" variant="caption">{actionError}</Typography>
        </Box>
      )}

      {/* Compact Stats Bar */}
      <Box
        sx={{
          display: 'flex',
          gap: 4,
          mb: 2,
          pb: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <StatItem
          label="Task Groups"
          value={job.TaskGroups?.length || 0}
          color={theme.palette.primary.main}
        />
        <StatItem
          label="Running"
          value={runningAllocs}
          color={runningAllocs > 0 ? colors.success : undefined}
          subValue={allocations.length > 0 ? `of ${allocations.length}` : undefined}
        />
        <StatItem
          label="Pending"
          value={pendingAllocs}
          color={pendingAllocs > 0 ? colors.pending : undefined}
        />
        <StatItem
          label="Failed"
          value={failedAllocs}
          color={failedAllocs > 0 ? colors.error : undefined}
        />
        {deployments.length > 0 && (
          <Box sx={{ ml: 'auto', borderLeft: `1px solid ${theme.palette.divider}`, pl: 3 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 0.25 }}>
              Deployment
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MinimalStatus status={deployments[0].Status || 'unknown'} />
              <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', fontSize: '0.65rem' }}>
                v{deployments[0].JobVersion}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Placement failures - compact */}
      <PlacementFailuresAlert failures={placementFailures} />

      {/* Tabs - compact */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{
            minHeight: 36,
            '& .MuiTab-root': { minHeight: 36, py: 0.5, px: 1.5, fontSize: '0.8rem' },
          }}
        >
          <Tab
            label="Overview"
            icon={<Icon icon="mdi:view-dashboard-outline" width={16} />}
            iconPosition="start"
          />
          <Tab
            label={`Task Groups (${job.TaskGroups?.length || 0})`}
            icon={<Icon icon="mdi:layers-triple" width={16} />}
            iconPosition="start"
          />
          <Tab
            label={`Allocations (${allocations.length})`}
            icon={<Icon icon="mdi:cube-outline" width={16} />}
            iconPosition="start"
          />
          {hasChildren && (
            <Tab
              label={`Children (${childJobs.length})`}
              icon={<Icon icon="mdi:file-tree" width={16} />}
              iconPosition="start"
            />
          )}
          <Tab
            label="Definition"
            icon={<Icon icon="mdi:code-json" width={16} />}
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          {/* Details */}
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
              Details
            </Typography>
            <Paper elevation={0} sx={{ p: 1.5, borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
              <DetailRow label="ID" value={<Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{job.ID}</Typography>} />
              <DetailRow label="Namespace" value={job.Namespace} />
              <DetailRow label="Type" value={job.Type} />
              <DetailRow label="Status" value={<MinimalStatus status={job.Status} />} />
              <DetailRow label="Priority" value={job.Priority} />
              <DetailRow label="Datacenters" value={job.Datacenters?.join(', ') || '—'} />
              <DetailRow label="Stable" value={job.Stable ? 'Yes' : 'No'} />
              {job.ParentID && (
                <DetailRow
                  label="Parent"
                  value={
                    <Link
                      component={RouterLink}
                      to={createRouteURL('nomadJob', { name: job.ParentID, namespace: job.Namespace })}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      {job.ParentID}
                    </Link>
                  }
                />
              )}
              <DetailRow
                label="Submitted"
                value={job.SubmitTime ? <DateLabel date={new Date(job.SubmitTime / 1000000)} /> : '—'}
              />
            </Paper>
          </Box>

          {/* Deployment */}
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
              {deployments.length > 0 ? 'Latest Deployment' : 'Deployment'}
            </Typography>
            {deployments.length > 0 ? (
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
                <DeploymentProgress deployment={deployments[0]} />
                {deployments.length > 1 && (
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', mt: 1, display: 'block' }}>
                    + {deployments.length - 1} previous
                  </Typography>
                )}
              </Paper>
            ) : (
              <Paper elevation={0} sx={{ p: 2, borderRadius: 1, border: `1px solid ${theme.palette.divider}`, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>No deployments</Typography>
              </Paper>
            )}
          </Box>

          {/* Periodic config */}
          {job.Periodic && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
                Periodic Config
              </Typography>
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
                <DetailRow label="Enabled" value={job.Periodic.Enabled ? 'Yes' : 'No'} />
                <DetailRow label="Spec" value={<Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{job.Periodic.Spec || '—'}</Typography>} />
                <DetailRow label="Type" value={job.Periodic.SpecType || 'cron'} />
                <DetailRow label="Prohibit Overlap" value={job.Periodic.ProhibitOverlap ? 'Yes' : 'No'} />
                <DetailRow label="Time Zone" value={job.Periodic.TimeZone || 'UTC'} />
              </Paper>
            </Box>
          )}

          {/* Parameterized config */}
          {job.ParameterizedJob && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
                Parameterized Config
              </Typography>
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
                <DetailRow label="Payload" value={job.ParameterizedJob.Payload || 'none'} />
                <DetailRow label="Meta Required" value={job.ParameterizedJob.MetaRequired?.join(', ') || '—'} />
                <DetailRow label="Meta Optional" value={job.ParameterizedJob.MetaOptional?.join(', ') || '—'} />
              </Paper>
            </Box>
          )}

          {/* Metadata */}
          {metaEntries.length > 0 && (
            <Box sx={{ gridColumn: { md: '1 / -1' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Metadata ({metaEntries.length})
                </Typography>
                <Button
                  size="small"
                  onClick={() => setMetaExpanded(!metaExpanded)}
                  sx={{ minWidth: 'auto', px: 1, py: 0.25, fontSize: '0.7rem' }}
                >
                  {metaExpanded ? 'Collapse' : 'Expand'}
                </Button>
              </Box>

              <Collapse in={metaExpanded}>
                <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
                    {metaEntries.sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                      <Box key={key} sx={{ p: 1.5, borderBottom: `1px solid ${theme.palette.divider}`, borderRight: `1px solid ${theme.palette.divider}` }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', display: 'block', mb: 0.25 }}>
                          {key}
                        </Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', wordBreak: 'break-all' }}>
                          {value || '—'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              </Collapse>

              {!metaExpanded && (
                <Paper elevation={0} sx={{ p: 1, borderRadius: 1, border: `1px solid ${theme.palette.divider}`, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {metaEntries.slice(0, 8).map(([key]) => (
                    <Chip key={key} size="small" label={key} sx={{ fontFamily: 'monospace', fontSize: '0.65rem', height: 20 }} />
                  ))}
                  {metaEntries.length > 8 && (
                    <Chip
                      size="small"
                      label={`+${metaEntries.length - 8}`}
                      color="primary"
                      variant="outlined"
                      onClick={() => setMetaExpanded(true)}
                      sx={{ cursor: 'pointer', fontSize: '0.65rem', height: 20 }}
                    />
                  )}
                </Paper>
              )}
            </Box>
          )}
        </Box>
      </TabPanel>

      {/* Task Groups Tab - Dense Table */}
      <TabPanel value={tabValue} index={1}>
        <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
          {/* Header */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr 100px 140px 100px 80px',
              alignItems: 'center',
              gap: 2,
              py: 0.75,
              px: 1.5,
              backgroundColor: alpha(theme.palette.text.primary, 0.02),
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase' }}>Name</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'center' }}>Count</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'right' }}>Allocations</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'right' }}>CPU</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'right' }}>Memory</Typography>
          </Box>
          {/* Rows */}
          {job.TaskGroups?.map(taskGroup => (
            <TaskGroupRow
              key={taskGroup.Name}
              taskGroup={taskGroup}
              allocations={allocations}
              namespace={job.Namespace}
              jobId={job.ID}
            />
          ))}
        </Paper>
      </TabPanel>

      {/* Allocations Tab */}
      <TabPanel value={tabValue} index={2}>
        <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
          {allocations.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>No allocations</Typography>
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
                      sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                    >
                      {alloc.ID.substring(0, 8)}
                    </Link>
                  ),
                },
                { label: 'Task Group', getter: (alloc: AllocationListStub) => alloc.TaskGroup },
                {
                  label: 'Node',
                  getter: (alloc: AllocationListStub) => (
                    <Link component={RouterLink} to={createRouteURL('nomadNode', { id: alloc.NodeID })} sx={{ fontSize: '0.8rem' }}>
                      {alloc.NodeName}
                    </Link>
                  ),
                },
                {
                  label: 'Status',
                  getter: (alloc: AllocationListStub) => <MinimalStatus status={alloc.ClientStatus} />,
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
          <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
            <SimpleTable
              columns={[
                {
                  label: 'Name',
                  getter: (child: JobListStub) => (
                    <Link
                      component={RouterLink}
                      to={createRouteURL('nomadJob', { name: child.ID, namespace: child.Namespace })}
                      sx={{ fontSize: '0.8rem' }}
                    >
                      {child.ID.split('/').pop() || child.Name}
                    </Link>
                  ),
                },
                {
                  label: 'Type',
                  getter: (child: JobListStub) => (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{child.Type}</Typography>
                  ),
                },
                {
                  label: 'Status',
                  getter: (child: JobListStub) => <MinimalStatus status={child.Status} />,
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
        <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              backgroundColor: alpha(theme.palette.text.primary, 0.02),
              borderBottom: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
              Job Definition (JSON)
            </Typography>
            <Tooltip title="Copy">
              <IconButton
                size="small"
                onClick={() => navigator.clipboard.writeText(JSON.stringify(job, null, 2))}
                sx={{ p: 0.5 }}
              >
                <Icon icon="mdi:content-copy" width={14} />
              </IconButton>
            </Tooltip>
          </Box>
          <JsonView json={JSON.stringify(job, null, 2)} />
        </Paper>
      </TabPanel>

      {/* Dialogs */}
      <Dialog open={stopDialogOpen} onClose={() => setStopDialogOpen(false)} maxWidth="xs">
        <DialogTitle sx={{ fontSize: '1rem', pb: 1 }}>Stop Job</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.85rem' }}>
            Stop all running allocations for "{job.Name}"? The job definition will be kept.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setStopDialogOpen(false)} size="small">Cancel</Button>
          <Button onClick={handleStopJob} color="warning" variant="contained" size="small">Stop</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={purgeDialogOpen} onClose={() => setPurgeDialogOpen(false)} maxWidth="xs">
        <DialogTitle sx={{ fontSize: '1rem', pb: 1 }}>Purge Job</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.85rem' }}>
            Permanently delete "{job.Name}" and all history? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setPurgeDialogOpen(false)} size="small">Cancel</Button>
          <Button onClick={handlePurgeJob} color="error" variant="contained" size="small">Purge</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
