import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  Link,
  Paper,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import StopIcon from '@mui/icons-material/Stop';
import DeleteIcon from '@mui/icons-material/Delete';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SendIcon from '@mui/icons-material/Send';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { getJob, getJobAllocations, deleteJob, scaleJob, listJobs, listDeployments } from '../../../lib/nomad/api';
import { Job, AllocationListStub, JobListStub, Deployment } from '../../../lib/nomad/types';
import { SectionBox, NameValueTable, SimpleTable } from '../../common';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { StatusChip } from '../statusStyles';
import { CopyableId } from '../CopyButton';

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

// Get parent job ID from hierarchical job ID (e.g., "parent/child/grandchild" -> "parent/child")
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

// Job type badge component
function JobTypeBadge({ job }: { job: Job }) {
  const badges = [];

  if (job.Periodic) {
    badges.push(
      <Tooltip key="periodic" title="Periodic job - runs on a schedule">
        <Chip
          icon={<ScheduleIcon sx={{ fontSize: 14 }} />}
          label="Periodic"
          size="small"
          color="info"
          variant="outlined"
          sx={{ height: 24 }}
        />
      </Tooltip>
    );
  }

  if (job.ParameterizedJob) {
    badges.push(
      <Tooltip key="parameterized" title="Parameterized job - can be dispatched">
        <Chip
          icon={<SendIcon sx={{ fontSize: 14 }} />}
          label="Parameterized"
          size="small"
          color="secondary"
          variant="outlined"
          sx={{ height: 24 }}
        />
      </Tooltip>
    );
  }

  if (job.ParentID) {
    badges.push(
      <Tooltip key="child" title="Child job - spawned from a parent job">
        <Chip
          icon={<AccountTreeIcon sx={{ fontSize: 14 }} />}
          label="Child"
          size="small"
          color="default"
          variant="outlined"
          sx={{ height: 24 }}
        />
      </Tooltip>
    );
  }

  return badges.length > 0 ? (
    <Box display="flex" gap={0.5} flexWrap="wrap">
      {badges}
    </Box>
  ) : null;
}

export default function JobDetails() {
  const params = useParams<{ name: string; namespace: string }>();
  // Decode URL params since they come encoded from the URL
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

      // Find child jobs (jobs with this job as parent)
      const children = (allJobsData || []).filter(
        j => j.ParentID === name || getParentJobId(j.ID) === name
      );
      setChildJobs(children);

      // Filter deployments for this job
      const jobDeployments = (deploymentsData || []).filter(d => d.JobID === name);
      // Sort by create index (most recent first)
      jobDeployments.sort((a, b) => (b.JobCreateIndex || 0) - (a.JobCreateIndex || 0));
      setDeployments(jobDeployments);

      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }

  // Build breadcrumb hierarchy
  const breadcrumbs = useMemo(() => {
    if (!job) return [];
    const hierarchy = getJobHierarchy(job.ID);
    // Remove the last one (current job)
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
      // Redirect to jobs list after purge
      window.location.href = createRouteURL('nomadJobs');
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function handleScaleTaskGroup(groupName: string, count: number) {
    if (!name) return;
    try {
      setActionError(null);
      await scaleJob(name, groupName, count, namespace);
      loadJob();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Typography color="error">Error: {error.message}</Typography>;
  }

  if (!job) {
    return <Typography>Job not found</Typography>;
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Check if this is a parent job (has children)
  const hasChildren = childJobs.length > 0;
  const isChildJob = job.ParentID || breadcrumbs.length > 0;

  return (
    <>
      {/* Breadcrumb navigation for job hierarchy */}
      {(breadcrumbs.length > 0 || job.ParentID) && (
        <Box sx={{ px: 2, pt: 2 }}>
          <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
            <Link
              component={RouterLink}
              to={createRouteURL('nomadJobs')}
              color="inherit"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              Jobs
            </Link>
            {job.ParentID && !breadcrumbs.some(b => b.id === job.ParentID) && (
              <Link
                component={RouterLink}
                to={createRouteURL('nomadJob', {
                  name: job.ParentID,
                  namespace: job.Namespace,
                })}
                color="inherit"
              >
                {job.ParentID.split('/').pop() || job.ParentID}
              </Link>
            )}
            {breadcrumbs.map(b => (
              <Link
                key={b.id}
                component={RouterLink}
                to={createRouteURL('nomadJob', {
                  name: b.id,
                  namespace: job.Namespace,
                })}
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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 2,
          p: 2,
        }}
      >
        <Box>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Typography variant="h4">{job.Name}</Typography>
            <StatusChip status={job.Status} />
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip label={job.Type} size="small" variant="outlined" />
            <JobTypeBadge job={job} />
            {hasChildren && (
              <Tooltip title={`${childJobs.length} child job${childJobs.length > 1 ? 's' : ''}`}>
                <Chip
                  icon={<AccountTreeIcon sx={{ fontSize: 14 }} />}
                  label={`${childJobs.length} children`}
                  size="small"
                  color="info"
                  variant="outlined"
                />
              </Tooltip>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadJob}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {job.Status !== 'dead' && (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<StopIcon />}
              onClick={() => setStopDialogOpen(true)}
              size="small"
            >
              Stop
            </Button>
          )}
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setPurgeDialogOpen(true)}
            size="small"
          >
            Purge
          </Button>
        </Box>
      </Box>

      {actionError && (
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography color="error">{actionError}</Typography>
        </Box>
      )}

      {/* Stop Job Dialog */}
      <Dialog open={stopDialogOpen} onClose={() => setStopDialogOpen(false)}>
        <DialogTitle>Stop Job</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Are you sure you want to stop the job "${job.Name}"? This will stop all running allocations but keep the job definition.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStopDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleStopJob} color="warning" variant="contained">
            Stop
          </Button>
        </DialogActions>
      </Dialog>

      {/* Purge Job Dialog */}
      <Dialog open={purgeDialogOpen} onClose={() => setPurgeDialogOpen(false)}>
        <DialogTitle>Purge Job</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Are you sure you want to purge the job "${job.Name}"? This will permanently delete the job and all its history. This action cannot be undone.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPurgeDialogOpen(false)}>Cancel</Button>
          <Button onClick={handlePurgeJob} color="error" variant="contained">
            Purge
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Task Groups" />
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={0.5}>
                Allocations
                <Chip label={allocations.length} size="small" sx={{ height: 20 }} />
              </Box>
            }
          />
          {hasChildren && (
            <Tab
              label={
                <Box display="flex" alignItems="center" gap={0.5}>
                  Child Jobs
                  <Chip label={childJobs.length} size="small" color="info" sx={{ height: 20 }} />
                </Box>
              }
            />
          )}
          <Tab label="Definition" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <SectionBox title="Details">
              <NameValueTable
                rows={[
                  {
                    name: 'ID',
                    value: <CopyableId id={job.ID} length={job.ID.length} />,
                  },
                  { name: 'Namespace', value: job.Namespace },
                  { name: 'Type', value: job.Type },
                  {
                    name: 'Status',
                    value: <StatusChip status={job.Status} />,
                  },
                  { name: 'Priority', value: job.Priority },
                  { name: 'Datacenters', value: job.Datacenters?.join(', ') },
                  { name: 'Version', value: job.Version },
                  { name: 'Stable', value: job.Stable ? 'Yes' : 'No' },
                  ...(job.ParentID
                    ? [
                        {
                          name: 'Parent Job',
                          value: (
                            <Link
                              component={RouterLink}
                              to={createRouteURL('nomadJob', {
                                name: job.ParentID,
                                namespace: job.Namespace,
                              })}
                            >
                              {job.ParentID}
                            </Link>
                          ),
                        },
                      ]
                    : []),
                  {
                    name: 'Submitted',
                    value: job.SubmitTime ? (
                      <DateLabel date={new Date(job.SubmitTime / 1000000)} />
                    ) : (
                      '-'
                    ),
                  },
                ]}
              />
            </SectionBox>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <SectionBox title="Summary">
              {job.TaskGroups && (
                <SimpleTable
                  columns={[
                    {
                      label: 'Task Group',
                      getter: tg => tg.Name,
                    },
                    {
                      label: 'Desired',
                      getter: tg => tg.Count,
                    },
                  ]}
                  data={job.TaskGroups}
                />
              )}
            </SectionBox>
          </Grid>

          {/* Active/Recent Deployment */}
          {deployments.length > 0 && (
            <Grid size={12}>
              <SectionBox title="Deployment">
                {(() => {
                  const deployment = deployments[0]; // Most recent deployment
                  const taskGroups = deployment.TaskGroups
                    ? Object.entries(deployment.TaskGroups)
                    : [];

                  return (
                    <Box>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <NameValueTable
                            rows={[
                              {
                                name: 'ID',
                                value: <CopyableId id={deployment.ID} />,
                              },
                              {
                                name: 'Status',
                                value: <StatusChip status={deployment.Status || 'unknown'} />,
                              },
                              {
                                name: 'Description',
                                value: deployment.StatusDescription || '-',
                              },
                              {
                                name: 'Version',
                                value: deployment.JobVersion?.toString() || '-',
                              },
                            ]}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <NameValueTable
                            rows={[
                              {
                                name: 'Auto Revert',
                                value: deployment.TaskGroups
                                  ? Object.values(deployment.TaskGroups).some(tg => tg.AutoRevert)
                                    ? 'Yes'
                                    : 'No'
                                  : '-',
                              },
                              {
                                name: 'Promoted',
                                value: deployment.TaskGroups
                                  ? Object.values(deployment.TaskGroups).some(tg => tg.Promoted)
                                    ? 'Yes'
                                    : 'No'
                                  : '-',
                              },
                              {
                                name: 'Is Active',
                                value: deployment.Status === 'running' ? 'Yes' : 'No',
                              },
                            ]}
                          />
                        </Grid>
                      </Grid>

                      {taskGroups.length > 0 && (
                        <SimpleTable
                          columns={[
                            {
                              label: 'Task Group',
                              getter: ([name]: [string, any]) => name,
                            },
                            {
                              label: 'Desired',
                              getter: ([, state]: [string, any]) => state.DesiredTotal || 0,
                            },
                            {
                              label: 'Placed',
                              getter: ([, state]: [string, any]) => state.PlacedAllocs || 0,
                            },
                            {
                              label: 'Healthy',
                              getter: ([, state]: [string, any]) => (
                                <Typography
                                  component="span"
                                  sx={{
                                    color: state.HealthyAllocs > 0 ? 'success.main' : 'text.secondary',
                                    fontWeight: state.HealthyAllocs > 0 ? 600 : 400,
                                  }}
                                >
                                  {state.HealthyAllocs || 0}
                                </Typography>
                              ),
                            },
                            {
                              label: 'Unhealthy',
                              getter: ([, state]: [string, any]) => (
                                <Typography
                                  component="span"
                                  sx={{
                                    color: state.UnhealthyAllocs > 0 ? 'error.main' : 'text.secondary',
                                    fontWeight: state.UnhealthyAllocs > 0 ? 600 : 400,
                                  }}
                                >
                                  {state.UnhealthyAllocs || 0}
                                </Typography>
                              ),
                            },
                            {
                              label: 'Canaries',
                              getter: ([, state]: [string, any]) =>
                                state.DesiredCanaries
                                  ? `${state.PlacedCanaries || 0}/${state.DesiredCanaries}`
                                  : '-',
                            },
                            {
                              label: 'Progress',
                              getter: ([, state]: [string, any]) => {
                                const total = state.DesiredTotal || 0;
                                const healthy = state.HealthyAllocs || 0;
                                if (total === 0) return '-';
                                const percent = Math.round((healthy / total) * 100);
                                return (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box
                                      sx={{
                                        width: 60,
                                        height: 6,
                                        borderRadius: 3,
                                        backgroundColor: 'action.hover',
                                        overflow: 'hidden',
                                      }}
                                    >
                                      <Box
                                        sx={{
                                          width: `${percent}%`,
                                          height: '100%',
                                          backgroundColor:
                                            percent === 100 ? 'success.main' : 'primary.main',
                                        }}
                                      />
                                    </Box>
                                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                      {percent}%
                                    </Typography>
                                  </Box>
                                );
                              },
                            },
                          ]}
                          data={taskGroups}
                        />
                      )}

                      {deployments.length > 1 && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 1, fontSize: '0.75rem' }}
                        >
                          + {deployments.length - 1} previous deployment
                          {deployments.length > 2 ? 's' : ''}
                        </Typography>
                      )}
                    </Box>
                  );
                })()}
              </SectionBox>
            </Grid>
          )}

          {/* Periodic config section */}
          {job.Periodic && (
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionBox title="Periodic Configuration">
                <NameValueTable
                  rows={[
                    { name: 'Enabled', value: job.Periodic.Enabled ? 'Yes' : 'No' },
                    { name: 'Spec', value: job.Periodic.Spec || '-' },
                    { name: 'Spec Type', value: job.Periodic.SpecType || 'cron' },
                    {
                      name: 'Prohibit Overlap',
                      value: job.Periodic.ProhibitOverlap ? 'Yes' : 'No',
                    },
                    { name: 'Time Zone', value: job.Periodic.TimeZone || 'UTC' },
                  ]}
                />
              </SectionBox>
            </Grid>
          )}

          {/* Parameterized config section */}
          {job.ParameterizedJob && (
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionBox title="Parameterized Configuration">
                <NameValueTable
                  rows={[
                    {
                      name: 'Payload',
                      value: job.ParameterizedJob.Payload || 'none',
                    },
                    {
                      name: 'Meta Required',
                      value: job.ParameterizedJob.MetaRequired?.join(', ') || '-',
                    },
                    {
                      name: 'Meta Optional',
                      value: job.ParameterizedJob.MetaOptional?.join(', ') || '-',
                    },
                  ]}
                />
              </SectionBox>
            </Grid>
          )}

          {job.Meta && Object.keys(job.Meta).length > 0 && (
            <Grid size={12}>
              <SectionBox title="Metadata">
                <NameValueTable
                  rows={Object.entries(job.Meta).map(([key, value]) => ({
                    name: key,
                    value: value,
                  }))}
                />
              </SectionBox>
            </Grid>
          )}

          {job.Constraints && job.Constraints.length > 0 && (
            <Grid size={12}>
              <SectionBox title="Constraints">
                <SimpleTable
                  columns={[
                    { label: 'Target', getter: c => c.LTarget },
                    { label: 'Operand', getter: c => c.Operand },
                    { label: 'Value', getter: c => c.RTarget },
                  ]}
                  data={job.Constraints}
                />
              </SectionBox>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {job.TaskGroups?.map(taskGroup => (
          <SectionBox key={taskGroup.Name} title={taskGroup.Name}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <NameValueTable
                  rows={[
                    { name: 'Count', value: taskGroup.Count },
                    {
                      name: 'Tasks',
                      value: taskGroup.Tasks?.length || 0,
                    },
                  ]}
                />
              </Grid>
              <Grid size={12}>
                <Typography variant="h6" gutterBottom>
                  Tasks
                </Typography>
                <SimpleTable
                  columns={[
                    { label: 'Name', getter: task => task.Name },
                    { label: 'Driver', getter: task => task.Driver },
                    {
                      label: 'Resources',
                      getter: task =>
                        `CPU: ${task.Resources?.CPU || '-'}, Memory: ${
                          task.Resources?.MemoryMB || '-'
                        }MB`,
                    },
                  ]}
                  data={taskGroup.Tasks || []}
                />
              </Grid>
            </Grid>
          </SectionBox>
        ))}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <SectionBox title={`Allocations (${allocations.length})`}>
          <SimpleTable
            columns={[
              {
                label: 'ID',
                getter: (alloc: AllocationListStub) => (
                  <Link
                    component={RouterLink}
                    to={createRouteURL('nomadAllocation', { id: alloc.ID })}
                  >
                    <CopyableId id={alloc.ID} />
                  </Link>
                ),
              },
              {
                label: 'Task Group',
                getter: (alloc: AllocationListStub) => alloc.TaskGroup,
              },
              {
                label: 'Node',
                getter: (alloc: AllocationListStub) => (
                  <Link
                    component={RouterLink}
                    to={createRouteURL('nomadNode', { id: alloc.NodeID })}
                  >
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
            emptyMessage="No allocations found"
          />
        </SectionBox>
      </TabPanel>

      {/* Child Jobs Tab - only shown if job has children */}
      {hasChildren && (
        <TabPanel value={tabValue} index={3}>
          <SectionBox title={`Child Jobs (${childJobs.length})`}>
            <SimpleTable
              columns={[
                {
                  label: 'Name',
                  getter: (child: JobListStub) => (
                    <Link
                      component={RouterLink}
                      to={createRouteURL('nomadJob', {
                        name: child.ID,
                        namespace: child.Namespace,
                      })}
                    >
                      {child.ID.split('/').pop() || child.Name}
                    </Link>
                  ),
                },
                {
                  label: 'ID',
                  getter: (child: JobListStub) => (
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {child.ID}
                    </Typography>
                  ),
                },
                {
                  label: 'Type',
                  getter: (child: JobListStub) => (
                    <Chip label={child.Type} size="small" variant="outlined" />
                  ),
                },
                {
                  label: 'Status',
                  getter: (child: JobListStub) => <StatusChip status={child.Status} />,
                },
                {
                  label: 'Submitted',
                  getter: (child: JobListStub) =>
                    child.SubmitTime ? (
                      <DateLabel date={new Date(child.SubmitTime / 1000000)} />
                    ) : (
                      '-'
                    ),
                },
              ]}
              data={childJobs.sort((a, b) => (b.SubmitTime || 0) - (a.SubmitTime || 0))}
              emptyMessage="No child jobs"
            />
          </SectionBox>
        </TabPanel>
      )}

      <TabPanel value={tabValue} index={hasChildren ? 4 : 3}>
        <SectionBox title="Job Definition">
          <Paper sx={{ p: 2 }}>
            <pre style={{ overflow: 'auto', maxHeight: '600px' }}>
              {JSON.stringify(job, null, 2)}
            </pre>
          </Paper>
        </SectionBox>
      </TabPanel>
    </>
  );
}
