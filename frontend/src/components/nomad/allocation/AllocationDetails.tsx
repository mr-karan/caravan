import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  alpha,
  Box,
  Button,
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
import { Allocation, AllocResourceUsage, TaskState, TaskResourceUsage } from '../../../lib/nomad/types';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import TaskLogs from './TaskLogs';
import TaskExec from './TaskExec';
import FileBrowser from './FileBrowser';
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

// Compact stat item for header
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
  
  const formatValue = (val: number | string) => {
    if (typeof val !== 'number') return val;
    return Number.isInteger(val) ? val.toString() : val.toFixed(1);
  };
  
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
          {formatValue(value)}
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

// Task sidebar item with stats
function TaskSidebarItem({
  task,
  taskStats,
  allocatedMemoryMB,
  isSelected,
  onSelect,
  onRestart,
}: {
  task: TaskState & { name: string };
  taskStats?: TaskResourceUsage;
  allocatedMemoryMB: number;
  isSelected: boolean;
  onSelect: () => void;
  onRestart: () => void;
}) {
  const theme = useTheme();
  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;

  const cpuPercent = taskStats?.ResourceUsage?.CpuStats?.Percent || 0;
  const memStats = taskStats?.ResourceUsage?.MemoryStats;
  const memoryBytes = memStats?.RSS || memStats?.Usage || 0;
  const memoryMB = memoryBytes / 1024 / 1024;

  return (
    <Box
      onClick={onSelect}
      sx={{
        p: 1.5,
        cursor: 'pointer',
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
        borderLeft: isSelected ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
        transition: 'all 0.15s ease',
        '&:hover': {
          backgroundColor: isSelected
            ? alpha(theme.palette.primary.main, 0.08)
            : alpha(theme.palette.primary.main, 0.03),
        },
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      {/* Task name and status */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: isSelected ? 600 : 500,
              fontSize: '0.8rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {task.name}
          </Typography>
          <MinimalStatus status={task.State} />
        </Box>
        <Tooltip title="Restart task">
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onRestart(); }}
            sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}
          >
            <Icon icon="mdi:restart" width={14} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem', textTransform: 'uppercase' }}>
            CPU
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
            <Typography
              sx={{
                fontSize: '0.85rem',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: theme.palette.info.main,
              }}
            >
              {cpuPercent.toFixed(1)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem' }}>%</Typography>
          </Box>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem', textTransform: 'uppercase' }}>
            Memory
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
            <Typography
              sx={{
                fontSize: '0.85rem',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: theme.palette.success.main,
              }}
            >
              {memoryMB.toFixed(0)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem' }}>
              {allocatedMemoryMB > 0 ? `/${allocatedMemoryMB}` : 'MB'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Memory progress bar */}
      {allocatedMemoryMB > 0 && (
        <LinearProgress
          variant="determinate"
          value={Math.min((memoryMB / allocatedMemoryMB) * 100, 100)}
          sx={{
            mt: 0.75,
            height: 2,
            borderRadius: 1,
            backgroundColor: alpha(theme.palette.divider, 0.3),
            '& .MuiLinearProgress-bar': {
              borderRadius: 1,
              backgroundColor: (memoryMB / allocatedMemoryMB) > 0.8
                ? theme.palette.error.main
                : theme.palette.success.main,
            },
          }}
        />
      )}

      {/* Restarts indicator */}
      {task.Restarts > 0 && (
        <Typography variant="caption" sx={{ color: colors.pending, fontSize: '0.6rem', mt: 0.5, display: 'block' }}>
          {task.Restarts} restart{task.Restarts !== 1 ? 's' : ''}
        </Typography>
      )}
    </Box>
  );
}

// Event item for task events
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

// Task detail panel with sub-tabs
function TaskDetailPanel({
  allocId,
  task,
  taskStats,
  allocatedMemoryMB,
  onRestart,
}: {
  allocId: string;
  task: TaskState & { name: string };
  taskStats?: TaskResourceUsage;
  allocatedMemoryMB: number;
  onRestart: () => void;
}) {
  const theme = useTheme();
  const [subTab, setSubTab] = useState(0);
  const [execCommand, setExecCommand] = useState('/bin/sh');
  const [execKey, setExecKey] = useState(0);

  const cpuPercent = taskStats?.ResourceUsage?.CpuStats?.Percent || 0;
  const memStats = taskStats?.ResourceUsage?.MemoryStats;
  const memoryBytes = memStats?.RSS || memStats?.Usage || 0;
  const memoryMB = memoryBytes / 1024 / 1024;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Task header with stats */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1.5,
          mb: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
              {task.name}
            </Typography>
            <MinimalStatus status={task.State} />
          </Box>
          {/* Inline stats */}
          <Box sx={{ display: 'flex', gap: 2, pl: 2, borderLeft: `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>CPU</Typography>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: theme.palette.info.main, fontVariantNumeric: 'tabular-nums' }}>
                {cpuPercent.toFixed(1)}%
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>MEM</Typography>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: theme.palette.success.main, fontVariantNumeric: 'tabular-nums' }}>
                {allocatedMemoryMB > 0 ? `${memoryMB.toFixed(0)}/${allocatedMemoryMB}` : `${memoryMB.toFixed(1)}`} MB
              </Typography>
            </Box>
          </Box>
        </Box>
        <Button
          onClick={onRestart}
          size="small"
          startIcon={<Icon icon="mdi:restart" width={14} />}
          sx={{ textTransform: 'none', fontSize: '0.75rem' }}
        >
          Restart
        </Button>
      </Box>

      {/* Sub-tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={subTab}
          onChange={(_, v) => setSubTab(v)}
          sx={{ minHeight: 32, '& .MuiTab-root': { minHeight: 32, py: 0.5, px: 1.5, fontSize: '0.75rem' } }}
        >
          <Tab label="Logs" icon={<Icon icon="mdi:text-box-outline" width={14} />} iconPosition="start" />
          <Tab label="Exec" icon={<Icon icon="mdi:console" width={14} />} iconPosition="start" />
          <Tab label="Files" icon={<Icon icon="mdi:folder-outline" width={14} />} iconPosition="start" />
          <Tab label="Events" icon={<Icon icon="mdi:history" width={14} />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Sub-tab content */}
      <Box sx={{ flexGrow: 1, minHeight: 0, pt: 1.5 }}>
        {/* Logs */}
        {subTab === 0 && (
          <Box sx={{ height: '100%' }}>
            <TaskLogs allocId={allocId} taskName={task.name} />
          </Box>
        )}

        {/* Exec */}
        {subTab === 1 && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                value={execCommand}
                onChange={e => setExecCommand(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && execCommand.trim()) setExecKey(prev => prev + 1); }}
                placeholder="/bin/sh"
                sx={{ minWidth: 200, '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.75rem', py: 0.5 } }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Icon icon="mdi:console-line" width={16} /></InputAdornment> }}
              />
              <IconButton size="small" onClick={() => setExecKey(prev => prev + 1)} disabled={!execCommand.trim()} color="primary" sx={{ p: 0.5 }}>
                <Icon icon="mdi:play" width={18} />
              </IconButton>
            </Box>
            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
              <TaskExec key={execKey} allocId={allocId} taskName={task.name} command={[execCommand.trim() || '/bin/sh']} onClose={() => {}} />
            </Box>
          </Box>
        )}

        {/* Files */}
        {subTab === 2 && (
          <Paper elevation={0} sx={{ height: '100%', borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
            <FileBrowser allocId={allocId} taskName={task.name} />
          </Paper>
        )}

        {/* Events */}
        {subTab === 3 && (
          <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
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
  const [statsUpdatedAt, setStatsUpdatedAt] = useState<Date | null>(null);
  const statsIntervalRef = useRef<number | null>(null);

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
  const memoryStats = stats?.ResourceUsage?.MemoryStats;
  const memoryBytes = memoryStats?.RSS || memoryStats?.Usage || 0;
  const memoryMB = memoryBytes / 1024 / 1024;
  const allocatedMemoryMB = allocation.AllocatedResources?.Tasks
    ? Object.values(allocation.AllocatedResources.Tasks).reduce(
        (sum, task) => sum + (task.Memory?.MemoryMB || 0),
        0
      )
    : 0;
  const runningTasks = taskStates.filter(t => t.State === 'running').length;

  // Get per-task allocated memory
  const getTaskAllocatedMemory = (taskName: string) => {
    return allocation.AllocatedResources?.Tasks?.[taskName]?.Memory?.MemoryMB || 0;
  };

  const selectedTaskData = taskStates.find(t => t.name === selectedTask);
  const selectedTaskStats = selectedTask ? stats?.Tasks?.[selectedTask] : undefined;

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
          value={allocatedMemoryMB > 0 ? `${memoryMB.toFixed(0)} / ${allocatedMemoryMB}` : memoryMB.toFixed(1)}
          unit="MB"
          percent={allocatedMemoryMB > 0 ? (memoryMB / allocatedMemoryMB) * 100 : undefined}
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

      {/* Tabs - simplified */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, px: 1.5, fontSize: '0.8rem' } }}
        >
          <Tab label="Overview" icon={<Icon icon="mdi:view-dashboard-outline" width={16} />} iconPosition="start" />
          <Tab label={`Tasks (${taskStates.length})`} icon={<Icon icon="mdi:cube-outline" width={16} />} iconPosition="start" />
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

      {/* Tasks Tab - New unified layout */}
      <TabPanel value={tabValue} index={1}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '220px 1fr' },
            gap: 2,
            height: 'calc(100vh - 380px)',
            minHeight: 450,
          }}
        >
          {/* Task Sidebar */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: 1,
              border: `1px solid ${theme.palette.divider}`,
              overflow: 'auto',
            }}
          >
            <Box
              sx={{
                py: 1,
                px: 1.5,
                backgroundColor: alpha(theme.palette.text.primary, 0.02),
                borderBottom: `1px solid ${theme.palette.divider}`,
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tasks
              </Typography>
            </Box>
            {taskStates.map(task => (
              <TaskSidebarItem
                key={task.name}
                task={task}
                taskStats={stats?.Tasks?.[task.name]}
                allocatedMemoryMB={getTaskAllocatedMemory(task.name)}
                isSelected={selectedTask === task.name}
                onSelect={() => setSelectedTask(task.name)}
                onRestart={() => handleRestart(task.name)}
              />
            ))}
          </Paper>

          {/* Task Detail Panel */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: 1,
              border: `1px solid ${theme.palette.divider}`,
              p: 2,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {selectedTaskData && id ? (
              <TaskDetailPanel
                allocId={id}
                task={selectedTaskData}
                taskStats={selectedTaskStats}
                allocatedMemoryMB={getTaskAllocatedMemory(selectedTask!)}
                onRestart={() => handleRestart(selectedTask!)}
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  Select a task to view details
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      </TabPanel>

      {/* Events Tab - All tasks */}
      <TabPanel value={tabValue} index={2}>
        {taskStates.map(task => (
          <Box key={task.name} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2" fontWeight={500}>{task.name}</Typography>
              <MinimalStatus status={task.State} />
            </Box>
            <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
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
