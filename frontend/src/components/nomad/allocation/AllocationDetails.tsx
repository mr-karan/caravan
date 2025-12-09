import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  alpha,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  InputAdornment,
  LinearProgress,
  Link,
  Paper,
  Skeleton,
  Tab,
  Tabs,
  TextField,
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
import { MinimalStatus, minimalStatusColors, getStatusCategory } from '../statusStyles';

// Stats polling interval in milliseconds
const STATS_POLL_INTERVAL = 3000;

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

// Compact stat item
function StatItem({
  label,
  value,
  unit,
  percent,
  color,
}: {
  label: string;
  value: number | string;
  unit?: string;
  percent?: number;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <Box sx={{ minWidth: 100 }}>
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
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
        <Typography
          sx={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: color || 'text.primary',
            lineHeight: 1.2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {typeof value === 'number' ? value.toFixed(1) : value}
        </Typography>
        {unit && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
            {unit}
          </Typography>
        )}
      </Box>
      {percent !== undefined && (
        <LinearProgress
          variant="determinate"
          value={Math.min(percent, 100)}
          sx={{
            mt: 0.5,
            height: 3,
            borderRadius: 1.5,
            backgroundColor: alpha(theme.palette.divider, 0.5),
            '& .MuiLinearProgress-bar': {
              borderRadius: 1.5,
              backgroundColor: percent > 80 ? theme.palette.error.main : color || theme.palette.primary.main,
            },
          }}
        />
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
      <Box sx={{ fontSize: '0.75rem', ...(mono ? { fontFamily: 'monospace', fontSize: '0.7rem' } : {}) }}>
        {value}
      </Box>
    </Box>
  );
}

// Compact task row
function TaskRow({
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
  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;
  const [expanded, setExpanded] = useState(false);

  const statusColor = task.State === 'running' ? colors.success
    : task.State === 'pending' ? colors.pending
    : task.Failed ? colors.error
    : colors.cancelled;

  const lastEvent = task.Events?.[task.Events.length - 1];

  return (
    <Box sx={{ borderBottom: `1px solid ${theme.palette.divider}`, '&:last-child': { borderBottom: 'none' } }}>
      {/* Main row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '24px 1fr 100px 100px auto',
          alignItems: 'center',
          gap: 2,
          py: 1,
          px: 1.5,
          '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.02) },
        }}
      >
        <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ p: 0.25 }}>
          <Icon icon={expanded ? 'mdi:chevron-down' : 'mdi:chevron-right'} width={16} color={theme.palette.text.secondary} />
        </IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight={500}>{task.name}</Typography>
          <MinimalStatus status={task.State} />
          {task.Failed && (
            <Typography variant="caption" sx={{ color: colors.error, fontSize: '0.65rem' }}>failed</Typography>
          )}
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          {task.Restarts} restart{task.Restarts !== 1 ? 's' : ''}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          {task.StartedAt ? <DateLabel date={new Date(task.StartedAt)} format="mini" /> : '—'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Logs">
            <IconButton size="small" onClick={onViewLogs} sx={{ p: 0.5 }}>
              <Icon icon="mdi:text-box-outline" width={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Terminal">
            <IconButton size="small" onClick={onExec} sx={{ p: 0.5 }}>
              <Icon icon="mdi:console" width={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Restart">
            <IconButton size="small" onClick={onRestart} sx={{ p: 0.5 }} color="warning">
              <Icon icon="mdi:restart" width={16} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Expanded: Last event */}
      <Collapse in={expanded}>
        {lastEvent && (
          <Box sx={{ px: 1.5, py: 1, pl: 5, backgroundColor: alpha(theme.palette.background.default, 0.5) }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', display: 'block', mb: 0.25 }}>
              Last Event
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                {lastEvent.Type}
              </Typography>
              {lastEvent.DisplayMessage && (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  — {lastEvent.DisplayMessage}
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Collapse>
    </Box>
  );
}

// Compact event item
function EventItem({ event, taskName }: { event: any; taskName: string }) {
  const theme = useTheme();
  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;

  const typeColor =
    event.Type === 'Started' || event.Type === 'Task Setup' ? colors.success
    : event.Type === 'Terminated' || event.Type === 'Killing' || event.Type === 'Killed' ? colors.error
    : event.Type === 'Restarting' || event.Type === 'Signaling' ? colors.pending
    : colors.default;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '120px 80px 1fr',
        gap: 2,
        py: 0.75,
        px: 1.5,
        borderBottom: `1px solid ${theme.palette.divider}`,
        '&:last-child': { borderBottom: 'none' },
        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.02) },
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
        {event.Time ? <DateLabel date={new Date(event.Time / 1000000)} format="mini" /> : '—'}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: typeColor, fontWeight: 500, fontSize: '0.7rem' }}
      >
        {event.Type}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
        {event.DisplayMessage || event.Message || '—'}
      </Typography>
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
  const [statsUpdatedAt, setStatsUpdatedAt] = useState<Date | null>(null);
  const statsIntervalRef = useRef<number | null>(null);
  const [execCommand, setExecCommand] = useState('/bin/sh');
  const [execKey, setExecKey] = useState(0);

  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;

  const loadAllocation = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const allocData = await getAllocation(id);
      setAllocation(allocData);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadStats = useCallback(async () => {
    if (!id) return;
    try {
      const statsData = await getAllocationStats(id);
      setStats(statsData);
      setStatsUpdatedAt(new Date());
    } catch (err) {
      console.warn('Failed to load allocation stats:', err);
    }
  }, [id]);

  useEffect(() => {
    loadAllocation();
    loadStats();
  }, [loadAllocation, loadStats]);

  useEffect(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    if (allocation?.ClientStatus === 'running' && id) {
      statsIntervalRef.current = window.setInterval(() => {
        loadStats();
      }, STATS_POLL_INTERVAL);
    }
    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, [allocation?.ClientStatus, id, loadStats]);

  useEffect(() => {
    if (allocation?.TaskStates && !selectedTask) {
      const tasks = Object.keys(allocation.TaskStates);
      if (tasks.length > 0) {
        setSelectedTask(tasks[0]);
      }
    }
  }, [allocation, selectedTask]);

  const refreshAfterAction = useCallback(() => {
    setTimeout(() => loadAllocation(), 500);
    setTimeout(() => loadAllocation(), 2000);
  }, [loadAllocation]);

  async function handleRestart(taskName?: string) {
    if (!id) return;
    try {
      await restartAllocation(id, taskName, !taskName);
      refreshAfterAction();
    } catch (err) {
      console.error('Failed to restart allocation:', err);
    }
  }

  async function handleStop() {
    if (!id) return;
    try {
      await stopAllocation(id);
      refreshAfterAction();
    } catch (err) {
      console.error('Failed to stop allocation:', err);
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
        <Button onClick={loadAllocation} size="small" sx={{ mt: 1 }}>
          Retry
        </Button>
      </Box>
    );
  }

  if (!allocation) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">Allocation not found</Typography>
      </Box>
    );
  }

  const taskStates = allocation.TaskStates
    ? Object.entries(allocation.TaskStates).map(([name, state]) => ({ name, ...state }))
    : [];

  const statusCategory = getStatusCategory(allocation.ClientStatus);
  const statusColor = colors[statusCategory];

  const cpuPercent = stats?.ResourceUsage?.CpuStats?.Percent || 0;
  const memoryMB = (stats?.ResourceUsage?.MemoryStats?.RSS || 0) / 1024 / 1024;
  const memoryMaxMB = (stats?.ResourceUsage?.MemoryStats?.MaxUsage || 0) / 1024 / 1024;
  const runningTasks = taskStates.filter(t => t.State === 'running').length;

  return (
    <Box sx={{ pb: 3 }}>
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
              {allocation.Name}
            </Typography>
            <MinimalStatus status={allocation.ClientStatus} />
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
              {allocation.ID.substring(0, 8)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Link
              component={RouterLink}
              to={createRouteURL('nomadJob', { name: allocation.JobID, namespace: allocation.Namespace })}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.8rem' }}
            >
              <Icon icon="mdi:briefcase-outline" width={14} />
              {allocation.JobID}
            </Link>
            <Link
              component={RouterLink}
              to={createRouteURL('nomadNode', { id: allocation.NodeID })}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.8rem' }}
            >
              <Icon icon="mdi:server" width={14} />
              {allocation.NodeName}
            </Link>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Icon icon="mdi:folder-outline" width={14} />
              {allocation.Namespace}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadAllocation} size="small" sx={{ p: 0.75 }}>
              <Icon icon="mdi:refresh" width={18} />
            </IconButton>
          </Tooltip>
          <Button
            onClick={() => handleRestart()}
            size="small"
            sx={{ minWidth: 'auto', px: 1.5, py: 0.5, fontSize: '0.75rem' }}
          >
            Restart All
          </Button>
          <Button
            onClick={handleStop}
            size="small"
            color="error"
            sx={{ minWidth: 'auto', px: 1.5, py: 0.5, fontSize: '0.75rem' }}
          >
            Stop
          </Button>
        </Box>
      </Box>

      {/* Compact Stats Bar */}
      <Box
        sx={{
          display: 'flex',
          gap: 4,
          mb: 2,
          pb: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          alignItems: 'flex-end',
        }}
      >
        <StatItem
          label="CPU"
          value={cpuPercent}
          unit="%"
          percent={cpuPercent}
          color={theme.palette.info.main}
        />
        <StatItem
          label="Memory"
          value={memoryMB}
          unit="MB"
          percent={memoryMaxMB > 0 ? (memoryMB / memoryMaxMB) * 100 : undefined}
          color={theme.palette.success.main}
        />
        <StatItem
          label="Tasks"
          value={taskStates.length}
          color={theme.palette.primary.main}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: colors.success, fontWeight: 500, fontSize: '0.8rem' }}>
            {runningTasks}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
            running
          </Typography>
        </Box>
        {statsUpdatedAt && allocation?.ClientStatus === 'running' && (
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: colors.success,
                animation: 'pulse 2s infinite',
                '@keyframes pulse': { '0%': { opacity: 1 }, '50%': { opacity: 0.4 }, '100%': { opacity: 1 } },
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
              Live
            </Typography>
          </Box>
        )}
      </Box>

      {/* Tabs - compact */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, px: 1.5, fontSize: '0.8rem' } }}
        >
          <Tab label="Overview" icon={<Icon icon="mdi:view-dashboard-outline" width={16} />} iconPosition="start" />
          <Tab label={`Tasks (${taskStates.length})`} icon={<Icon icon="mdi:cube-outline" width={16} />} iconPosition="start" />
          <Tab label="Logs" icon={<Icon icon="mdi:text-box-outline" width={16} />} iconPosition="start" />
          <Tab label="Exec" icon={<Icon icon="mdi:console" width={16} />} iconPosition="start" />
          <Tab label="Events" icon={<Icon icon="mdi:history" width={16} />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
              Details
            </Typography>
            <Paper elevation={0} sx={{ p: 1.5, borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
              <DetailRow label="ID" value={<Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{allocation.ID}</Typography>} />
              <DetailRow label="Name" value={allocation.Name} />
              <DetailRow label="Namespace" value={allocation.Namespace} />
              <DetailRow
                label="Job"
                value={
                  <Link component={RouterLink} to={createRouteURL('nomadJob', { name: allocation.JobID, namespace: allocation.Namespace })} sx={{ fontSize: '0.75rem' }}>
                    {allocation.JobID}
                  </Link>
                }
              />
              <DetailRow label="Task Group" value={allocation.TaskGroup} />
              <DetailRow
                label="Node"
                value={
                  <Link component={RouterLink} to={createRouteURL('nomadNode', { id: allocation.NodeID })} sx={{ fontSize: '0.75rem' }}>
                    {allocation.NodeName}
                  </Link>
                }
              />
              <DetailRow label="Client Status" value={<MinimalStatus status={allocation.ClientStatus} />} />
              <DetailRow label="Desired Status" value={allocation.DesiredStatus} />
              <DetailRow label="Created" value={<DateLabel date={new Date(allocation.CreateTime / 1000000)} />} />
              <DetailRow label="Modified" value={<DateLabel date={new Date(allocation.ModifyTime / 1000000)} />} />
            </Paper>
          </Box>

          {allocation.DeploymentID && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
                Deployment
              </Typography>
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
                <DetailRow
                  label="Deployment ID"
                  value={
                    <Link component={RouterLink} to={createRouteURL('nomadDeployment', { id: allocation.DeploymentID })} sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      {allocation.DeploymentID.substring(0, 8)}
                    </Link>
                  }
                />
                <DetailRow label="Healthy" value={allocation.DeploymentStatus?.Healthy ? 'Yes' : 'No'} />
                <DetailRow label="Canary" value={allocation.DeploymentStatus?.Canary ? 'Yes' : 'No'} />
              </Paper>
            </Box>
          )}
        </Box>
      </TabPanel>

      {/* Tasks Tab */}
      <TabPanel value={tabValue} index={1}>
        <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr 100px 100px auto',
              gap: 2,
              py: 0.75,
              px: 1.5,
              backgroundColor: alpha(theme.palette.text.primary, 0.02),
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase' }}>Task</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'center' }}>Restarts</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'center' }}>Started</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'right' }}>Actions</Typography>
          </Box>
          {taskStates.map(task => (
            <TaskRow
              key={task.name}
              task={task}
              onRestart={() => handleRestart(task.name)}
              onViewLogs={() => { setSelectedTask(task.name); setTabValue(2); }}
              onExec={() => { setSelectedTask(task.name); setTabValue(3); }}
            />
          ))}
        </Paper>
      </TabPanel>

      {/* Logs Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 320px)', minHeight: 400 }}>
          {/* Task selector */}
          <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
            {taskStates.map(task => (
              <Button
                key={task.name}
                variant={selectedTask === task.name ? 'contained' : 'outlined'}
                onClick={() => setSelectedTask(task.name)}
                size="small"
                sx={{ textTransform: 'none', borderRadius: 1, px: 1.5, py: 0.5, fontSize: '0.75rem' }}
                startIcon={<Icon icon={task.State === 'running' ? 'mdi:play-circle' : 'mdi:stop-circle'} width={14} />}
              >
                {task.name}
              </Button>
            ))}
          </Box>

          <Box sx={{ flexGrow: 1, minHeight: 0 }}>
            {selectedTask && id ? (
              <TaskLogs allocId={id} taskName={selectedTask} />
            ) : (
              <Paper elevation={0} sx={{ p: 3, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>Select a task to view logs</Typography>
              </Paper>
            )}
          </Box>
        </Box>
      </TabPanel>

      {/* Exec Tab */}
      <TabPanel value={tabValue} index={3}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 320px)', minHeight: 400 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            {taskStates.map(task => (
              <Button
                key={task.name}
                variant={selectedTask === task.name ? 'contained' : 'outlined'}
                onClick={() => setSelectedTask(task.name)}
                size="small"
                sx={{ textTransform: 'none', borderRadius: 1, px: 1.5, py: 0.5, fontSize: '0.75rem' }}
                startIcon={<Icon icon={task.State === 'running' ? 'mdi:play-circle' : 'mdi:stop-circle'} width={14} />}
              >
                {task.name}
              </Button>
            ))}
            <Box sx={{ width: 1, height: 24, borderLeft: `1px solid ${theme.palette.divider}`, mx: 0.5 }} />
            <TextField
              size="small"
              value={execCommand}
              onChange={e => setExecCommand(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && execCommand.trim()) setExecKey(prev => prev + 1); }}
              placeholder="/bin/sh"
              sx={{ minWidth: 180, '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.75rem', py: 0.5 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Icon icon="mdi:console-line" width={16} /></InputAdornment> }}
            />
            <IconButton size="small" onClick={() => setExecKey(prev => prev + 1)} disabled={!execCommand.trim()} color="primary" sx={{ p: 0.5 }}>
              <Icon icon="mdi:play" width={18} />
            </IconButton>
          </Box>

          <Box sx={{ flexGrow: 1, minHeight: 0 }}>
            {selectedTask && id ? (
              <TaskExec key={execKey} allocId={id} taskName={selectedTask} command={[execCommand.trim() || '/bin/sh']} onClose={() => setSelectedTask(null)} />
            ) : (
              <Paper elevation={0} sx={{ p: 3, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>Select a task to open terminal</Typography>
              </Paper>
            )}
          </Box>
        </Box>
      </TabPanel>

      {/* Events Tab */}
      <TabPanel value={tabValue} index={4}>
        {taskStates.map(task => (
          <Box key={task.name} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2" fontWeight={500}>{task.name}</Typography>
              <MinimalStatus status={task.State} />
            </Box>
            <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
              {/* Header */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '120px 80px 1fr',
                  gap: 2,
                  py: 0.5,
                  px: 1.5,
                  backgroundColor: alpha(theme.palette.text.primary, 0.02),
                  borderBottom: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase' }}>Time</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase' }}>Type</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase' }}>Message</Typography>
              </Box>
              {task.Events && task.Events.length > 0 ? (
                [...task.Events].reverse().map((event, idx) => (
                  <EventItem key={idx} event={event} taskName={task.name} />
                ))
              ) : (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>No events</Typography>
                </Box>
              )}
            </Paper>
          </Box>
        ))}
      </TabPanel>
    </Box>
  );
}
