import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
  getAllocation,
  getAllocationStats,
  restartAllocation,
  stopAllocation,
} from '../../../lib/nomad/api';
import { Allocation, AllocResourceUsage, TaskState } from '../../../lib/nomad/types';
import { SimpleTable } from '../../common';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import TaskLogs from './TaskLogs';
import TaskExec from './TaskExec';
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

// Resource usage card with progress bar
function ResourceCard({
  icon,
  label,
  value,
  total,
  unit,
  color,
  percent,
}: {
  icon: string;
  label: string;
  value: number;
  total?: number;
  unit: string;
  color: string;
  percent?: number;
}) {
  const theme = useTheme();
  const displayPercent = percent ?? (total ? Math.min((value / total) * 100, 100) : 0);

  const formatValue = (v: number) => {
    if (v >= 1024) return `${(v / 1024).toFixed(1)} GB`;
    return `${v.toFixed(1)} ${unit}`;
  };

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              backgroundColor: alpha(color, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon={icon} width={22} color={color} />
          </Box>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            {label}
          </Typography>
        </Box>

        <Typography variant="h5" fontWeight={600} sx={{ mb: 1 }}>
          {formatValue(value)}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinearProgress
            variant="determinate"
            value={displayPercent}
            sx={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: alpha(color, 0.1),
              '& .MuiLinearProgress-bar': {
                backgroundColor: displayPercent > 80 ? theme.palette.error.main : color,
                borderRadius: 3,
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40 }}>
            {displayPercent.toFixed(0)}%
          </Typography>
        </Box>
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

// Task card component
function TaskCard({
  task,
  onRestart,
  onViewLogs,
  onExec,
}: {
  task: TaskState & { name: string };
  onRestart: () => void;
  onViewLogs: () => void;
  onExec: () => void;
}) {
  const theme = useTheme();

  const stateColor =
    task.State === 'running'
      ? theme.palette.success.main
      : task.State === 'pending'
        ? theme.palette.warning.main
        : task.State === 'dead' && !task.Failed
          ? theme.palette.grey[500]
          : theme.palette.error.main;

  const lastEvent = task.Events?.[task.Events.length - 1];

  return (
    <Card
      elevation={0}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: stateColor,
          boxShadow: `0 4px 12px ${alpha(stateColor, 0.1)}`,
        },
      }}
    >
      <Box
        sx={{
          p: 2,
          backgroundColor: alpha(stateColor, 0.03),
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
              backgroundColor: alpha(stateColor, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px solid ${alpha(stateColor, 0.3)}`,
            }}
          >
            <Icon
              icon={
                task.State === 'running'
                  ? 'mdi:play-circle'
                  : task.State === 'pending'
                    ? 'mdi:clock-outline'
                    : 'mdi:stop-circle'
              }
              width={22}
              color={stateColor}
            />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              {task.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StatusChip status={task.State} />
              {task.Failed && (
                <Chip
                  size="small"
                  label="Failed"
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
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View Logs">
            <IconButton size="small" onClick={onViewLogs}>
              <Icon icon="mdi:text-box-outline" width={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Open Terminal">
            <IconButton size="small" onClick={onExec}>
              <Icon icon="mdi:console" width={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Restart Task">
            <IconButton size="small" onClick={onRestart} color="warning">
              <Icon icon="mdi:restart" width={18} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Restarts
            </Typography>
            <Typography variant="body2" fontWeight={500}>
              {task.Restarts}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Started
            </Typography>
            <Typography variant="body2" fontWeight={500}>
              {task.StartedAt ? <DateLabel date={new Date(task.StartedAt)} /> : '—'}
            </Typography>
          </Grid>
        </Grid>

        {lastEvent && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 1,
              backgroundColor: alpha(theme.palette.background.default, 0.5),
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Last Event
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
              <strong>{lastEvent.Type}</strong>
              {lastEvent.DisplayMessage && ` — ${lastEvent.DisplayMessage}`}
            </Typography>
          </Box>
        )}
      </Box>
    </Card>
  );
}

// Event timeline item
function EventItem({ event, isLast }: { event: any; isLast: boolean }) {
  const theme = useTheme();

  const typeColor =
    event.Type === 'Started' || event.Type === 'Task Setup'
      ? theme.palette.success.main
      : event.Type === 'Terminated' || event.Type === 'Killing' || event.Type === 'Killed'
        ? theme.palette.error.main
        : event.Type === 'Restarting' || event.Type === 'Signaling'
          ? theme.palette.warning.main
          : theme.palette.info.main;

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {/* Timeline */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: typeColor,
          }}
        />
        {!isLast && (
          <Box
            sx={{
              width: 2,
              flex: 1,
              backgroundColor: theme.palette.divider,
              mt: 0.5,
            }}
          />
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Chip
            size="small"
            label={event.Type}
            sx={{
              backgroundColor: alpha(typeColor, 0.1),
              color: typeColor,
              fontWeight: 500,
              fontSize: '0.7rem',
            }}
          />
          <Typography variant="caption" color="text.secondary">
            <DateLabel date={new Date(event.Time / 1000000)} />
          </Typography>
        </Box>
        {(event.DisplayMessage || event.Message) && (
          <Typography variant="body2" color="text.secondary">
            {event.DisplayMessage || event.Message}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function AllocationDetails() {
  const theme = useTheme();
  const { id } = useParams<{ id: string }>();
  const [allocation, setAllocation] = useState<Allocation | null>(null);
  const [stats, setStats] = useState<AllocResourceUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  useEffect(() => {
    loadAllocation();
  }, [id]);

  // Auto-select first task when allocation loads
  useEffect(() => {
    if (allocation?.TaskStates && !selectedTask) {
      const tasks = Object.keys(allocation.TaskStates);
      if (tasks.length > 0) {
        setSelectedTask(tasks[0]);
      }
    }
  }, [allocation, selectedTask]);

  async function loadAllocation() {
    if (!id) return;

    try {
      setLoading(true);
      const [allocData, statsData] = await Promise.all([
        getAllocation(id),
        getAllocationStats(id).catch(() => null),
      ]);
      setAllocation(allocData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRestart(taskName?: string) {
    if (!id) return;
    try {
      await restartAllocation(id, taskName, !taskName);
      loadAllocation();
    } catch (err) {
      console.error('Failed to restart allocation:', err);
    }
  }

  async function handleStop() {
    if (!id) return;
    try {
      await stopAllocation(id);
      loadAllocation();
    } catch (err) {
      console.error('Failed to stop allocation:', err);
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
          Error loading allocation: {error.message}
        </Typography>
        <Button onClick={loadAllocation} sx={{ mt: 2 }}>
          Retry
        </Button>
      </Box>
    );
  }

  if (!allocation) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">Allocation not found</Typography>
      </Box>
    );
  }

  const taskStates = allocation.TaskStates
    ? Object.entries(allocation.TaskStates).map(([name, state]) => ({
        name,
        ...state,
      }))
    : [];

  const statusColor =
    allocation.ClientStatus === 'running'
      ? theme.palette.success.main
      : allocation.ClientStatus === 'pending'
        ? theme.palette.warning.main
        : allocation.ClientStatus === 'complete'
          ? theme.palette.info.main
          : theme.palette.error.main;

  // Resource stats
  const cpuPercent = stats?.ResourceUsage?.CpuStats?.Percent || 0;
  const memoryMB = (stats?.ResourceUsage?.MemoryStats?.RSS || 0) / 1024 / 1024;
  const memoryMaxMB = (stats?.ResourceUsage?.MemoryStats?.MaxUsage || 0) / 1024 / 1024;

  return (
    <Box>
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
                  allocation.ClientStatus === 'running'
                    ? 'mdi:cube'
                    : allocation.ClientStatus === 'pending'
                      ? 'mdi:cube-outline'
                      : 'mdi:cube-off'
                }
                width={28}
                color={statusColor}
              />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                <Typography variant="h5" fontWeight={600}>
                  {allocation.Name}
                </Typography>
                <StatusChip status={allocation.ClientStatus} />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, flexWrap: 'wrap' }}>
                <Link
                  component={RouterLink}
                  to={createRouteURL('nomadJob', {
                    name: allocation.JobID,
                    namespace: allocation.Namespace,
                  })}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    fontSize: '0.875rem',
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  <Icon icon="mdi:briefcase-outline" width={16} />
                  {allocation.JobID}
                </Link>
                <Divider orientation="vertical" flexItem />
                <Link
                  component={RouterLink}
                  to={createRouteURL('nomadNode', { id: allocation.NodeID })}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    fontSize: '0.875rem',
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  <Icon icon="mdi:server" width={16} />
                  {allocation.NodeName}
                </Link>
                <Divider orientation="vertical" flexItem />
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
                  {allocation.ID.substring(0, 8)}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={loadAllocation} size="small">
                <Icon icon="mdi:refresh" width={20} />
              </IconButton>
            </Tooltip>
            <Button
              onClick={() => handleRestart()}
              variant="outlined"
              size="small"
              startIcon={<Icon icon="mdi:restart" width={18} />}
            >
              Restart All
            </Button>
            <Button
              onClick={handleStop}
              variant="outlined"
              size="small"
              color="error"
              startIcon={<Icon icon="mdi:stop" width={18} />}
            >
              Stop
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Resource stats */}
      {stats?.ResourceUsage && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ResourceCard
              icon="mdi:chip"
              label="CPU Usage"
              value={cpuPercent}
              unit="%"
              color={theme.palette.info.main}
              percent={cpuPercent}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ResourceCard
              icon="mdi:memory"
              label="Memory (RSS)"
              value={memoryMB}
              total={memoryMaxMB > 0 ? memoryMaxMB : undefined}
              unit="MB"
              color={theme.palette.success.main}
              percent={memoryMaxMB > 0 ? (memoryMB / memoryMaxMB) * 100 : undefined}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card
              elevation={0}
              sx={{
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                height: '100%',
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
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
                    <Icon icon="mdi:cube-outline" width={22} color={theme.palette.primary.main} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Tasks
                  </Typography>
                </Box>
                <Typography variant="h5" fontWeight={600}>
                  {taskStates.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {taskStates.filter(t => t.State === 'running').length} running
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

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
            label={`Tasks (${taskStates.length})`}
            icon={<Icon icon="mdi:cube-outline" width={18} />}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
          <Tab
            label="Logs"
            icon={<Icon icon="mdi:text-box-outline" width={18} />}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
          <Tab
            label="Exec"
            icon={<Icon icon="mdi:console" width={18} />}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
          <Tab
            label="Events"
            icon={<Icon icon="mdi:history" width={18} />}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
              DETAILS
            </Typography>
            <Paper
              elevation={0}
              sx={{ p: 2.5, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}
            >
              <DetailRow label="ID" value={allocation.ID} mono />
              <DetailRow label="Name" value={allocation.Name} />
              <DetailRow label="Namespace" value={allocation.Namespace} />
              <DetailRow
                label="Job"
                value={
                  <Link
                    component={RouterLink}
                    to={createRouteURL('nomadJob', {
                      name: allocation.JobID,
                      namespace: allocation.Namespace,
                    })}
                  >
                    {allocation.JobID}
                  </Link>
                }
              />
              <DetailRow label="Task Group" value={allocation.TaskGroup} />
              <DetailRow
                label="Node"
                value={
                  <Link
                    component={RouterLink}
                    to={createRouteURL('nomadNode', { id: allocation.NodeID })}
                  >
                    {allocation.NodeName}
                  </Link>
                }
              />
              <DetailRow label="Client Status" value={<StatusChip status={allocation.ClientStatus} />} />
              <DetailRow label="Desired Status" value={allocation.DesiredStatus} />
              <DetailRow
                label="Created"
                value={<DateLabel date={new Date(allocation.CreateTime / 1000000)} />}
              />
              <DetailRow
                label="Modified"
                value={<DateLabel date={new Date(allocation.ModifyTime / 1000000)} />}
              />
            </Paper>
          </Grid>

          {allocation.DeploymentID && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
                DEPLOYMENT
              </Typography>
              <Paper
                elevation={0}
                sx={{ p: 2.5, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}
              >
                <DetailRow
                  label="Deployment ID"
                  value={
                    <Link
                      component={RouterLink}
                      to={createRouteURL('nomadDeployment', { id: allocation.DeploymentID })}
                      sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                    >
                      {allocation.DeploymentID.substring(0, 8)}
                    </Link>
                  }
                />
                <DetailRow
                  label="Healthy"
                  value={
                    <Chip
                      size="small"
                      label={allocation.DeploymentStatus?.Healthy ? 'Yes' : 'No'}
                      color={allocation.DeploymentStatus?.Healthy ? 'success' : 'default'}
                    />
                  }
                />
                <DetailRow
                  label="Canary"
                  value={
                    <Chip
                      size="small"
                      label={allocation.DeploymentStatus?.Canary ? 'Yes' : 'No'}
                      color={allocation.DeploymentStatus?.Canary ? 'info' : 'default'}
                    />
                  }
                />
              </Paper>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      {/* Tasks Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2}>
          {taskStates.map(task => (
            <Grid key={task.name} size={{ xs: 12, md: 6 }}>
              <TaskCard
                task={task}
                onRestart={() => handleRestart(task.name)}
                onViewLogs={() => {
                  setSelectedTask(task.name);
                  setTabValue(2);
                }}
                onExec={() => {
                  setSelectedTask(task.name);
                  setTabValue(3);
                }}
              />
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Logs Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 340px)', minHeight: 400 }}>
          {/* Task selector */}
          <Paper
            elevation={0}
            sx={{
              display: 'flex',
              gap: 1,
              p: 1.5,
              mb: 2,
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              flexWrap: 'wrap',
            }}
          >
            {taskStates.map(task => (
              <Button
                key={task.name}
                variant={selectedTask === task.name ? 'contained' : 'outlined'}
                onClick={() => setSelectedTask(task.name)}
                size="small"
                sx={{ textTransform: 'none', borderRadius: 1.5 }}
                startIcon={
                  <Icon
                    icon={task.State === 'running' ? 'mdi:play-circle' : 'mdi:stop-circle'}
                    width={16}
                  />
                }
              >
                {task.name}
              </Button>
            ))}
          </Paper>

          <Box sx={{ flexGrow: 1, minHeight: 0 }}>
            {selectedTask && id ? (
              <TaskLogs allocId={id} taskName={selectedTask} />
            ) : (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Icon icon="mdi:text-box-outline" width={48} color={theme.palette.text.disabled} />
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  Select a task to view logs
                </Typography>
              </Paper>
            )}
          </Box>
        </Box>
      </TabPanel>

      {/* Exec Tab */}
      <TabPanel value={tabValue} index={3}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 340px)', minHeight: 400 }}>
          {/* Task selector */}
          <Paper
            elevation={0}
            sx={{
              display: 'flex',
              gap: 1,
              p: 1.5,
              mb: 2,
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              flexWrap: 'wrap',
            }}
          >
            {taskStates.map(task => (
              <Button
                key={task.name}
                variant={selectedTask === task.name ? 'contained' : 'outlined'}
                onClick={() => setSelectedTask(task.name)}
                size="small"
                sx={{ textTransform: 'none', borderRadius: 1.5 }}
                startIcon={
                  <Icon
                    icon={task.State === 'running' ? 'mdi:play-circle' : 'mdi:stop-circle'}
                    width={16}
                  />
                }
              >
                {task.name}
              </Button>
            ))}
          </Paper>

          <Box sx={{ flexGrow: 1, minHeight: 0 }}>
            {selectedTask && id ? (
              <TaskExec allocId={id} taskName={selectedTask} onClose={() => setSelectedTask(null)} />
            ) : (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Icon icon="mdi:console" width={48} color={theme.palette.text.disabled} />
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  Select a task to open a terminal
                </Typography>
              </Paper>
            )}
          </Box>
        </Box>
      </TabPanel>

      {/* Events Tab */}
      <TabPanel value={tabValue} index={4}>
        {taskStates.map(task => (
          <Box key={task.name} sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon icon="mdi:cube-outline" width={18} color={theme.palette.primary.main} />
              </Box>
              <Typography variant="subtitle1" fontWeight={600}>
                {task.name}
              </Typography>
              <StatusChip status={task.State} />
            </Box>

            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              {task.Events && task.Events.length > 0 ? (
                [...task.Events].reverse().map((event, idx, arr) => (
                  <EventItem key={idx} event={event} isLast={idx === arr.length - 1} />
                ))
              ) : (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Icon icon="mdi:history" width={32} color={theme.palette.text.disabled} />
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    No events
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>
        ))}
      </TabPanel>
    </Box>
  );
}
