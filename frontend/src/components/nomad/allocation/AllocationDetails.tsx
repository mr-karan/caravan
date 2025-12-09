import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Grid,
  Link,
  Paper,
  Tab,
  Tabs,
  Typography,
  IconButton,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import StopIcon from '@mui/icons-material/Stop';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { getAllocation, getAllocationStats, restartAllocation, stopAllocation } from '../../../lib/nomad/api';
import { Allocation, AllocResourceUsage, TaskState } from '../../../lib/nomad/types';
import { SectionBox, NameValueTable, SimpleTable } from '../../common';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import TaskLogs from './TaskLogs';
import TaskExec from './TaskExec';
import { StatusChip } from '../statusStyles';

interface MainInfoSectionProps {
  title: string;
  resource?: any;
  headerStyle?: string;
  actions?: React.ReactNode[];
}

function MainInfoSection({ title, actions }: MainInfoSectionProps) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 2 }}>
      <Typography variant="h4">{title}</Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {actions}
      </Box>
    </Box>
  );
}

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

export default function AllocationDetails() {
  
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

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Typography color="error">Error: {error.message}</Typography>;
  }

  if (!allocation) {
    return <Typography>Allocation not found</Typography>;
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const taskStates = allocation.TaskStates
    ? Object.entries(allocation.TaskStates).map(([name, state]) => ({
        name,
        ...state,
      }))
    : [];

  return (
    <>
      <MainInfoSection
        title={allocation.Name}
        resource={allocation}
        headerStyle="normal"
        actions={[
          <IconButton key="refresh" onClick={loadAllocation} title="Refresh">
            <RefreshIcon />
          </IconButton>,
          <Button
            key="restart"
            startIcon={<RestartAltIcon />}
            onClick={() => handleRestart()}
            variant="outlined"
            size="small"
          >
            Restart All
          </Button>,
          <Button
            key="stop"
            startIcon={<StopIcon />}
            onClick={handleStop}
            variant="outlined"
            color="error"
            size="small"
          >
            Stop
          </Button>,
        ]}
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Tasks" />
          <Tab label="Logs" />
          <Tab label="Exec" />
          <Tab label="Resources" />
          <Tab label="Events" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <SectionBox title="Details">
              <NameValueTable
                rows={[
                  { name: 'ID', value: allocation.ID },
                  { name: 'Name', value: allocation.Name },
                  { name: 'Namespace', value: allocation.Namespace },
                  {
                    name: 'Job',
                    value: (
                      <Link
                        component={RouterLink}
                        to={createRouteURL('nomadJob', {
                          name: allocation.JobID,
                          namespace: allocation.Namespace,
                        })}
                      >
                        {allocation.JobID}
                      </Link>
                    ),
                  },
                  { name: 'Task Group', value: allocation.TaskGroup },
                  {
                    name: 'Node',
                    value: (
                      <Link
                        component={RouterLink}
                        to={createRouteURL('nomadNode', { id: allocation.NodeID })}
                      >
                        {allocation.NodeName}
                      </Link>
                    ),
                  },
                  {
                    name: 'Client Status',
                    value: <StatusChip status={allocation.ClientStatus} />,
                  },
                  {
                    name: 'Desired Status',
                    value: allocation.DesiredStatus,
                  },
                  {
                    name: 'Created',
                    value: <DateLabel date={new Date(allocation.CreateTime / 1000000)} />,
                  },
                  {
                    name: 'Modified',
                    value: <DateLabel date={new Date(allocation.ModifyTime / 1000000)} />,
                  },
                ]}
              />
            </SectionBox>
          </Grid>

          {allocation.DeploymentID && (
            <Grid size={{ xs: 12, md: 6 }}>
              <SectionBox title="Deployment">
                <NameValueTable
                  rows={[
                    {
                      name: 'Deployment ID',
                      value: (
                        <Link
                          component={RouterLink}
                          to={createRouteURL('nomadDeployment', {
                            id: allocation.DeploymentID,
                          })}
                        >
                          {allocation.DeploymentID.substring(0, 8)}
                        </Link>
                      ),
                    },
                    {
                      name: 'Healthy',
                      value: allocation.DeploymentStatus?.Healthy ? 'Yes' : 'No',
                    },
                    {
                      name: 'Canary',
                      value: allocation.DeploymentStatus?.Canary ? 'Yes' : 'No',
                    },
                  ]}
                />
              </SectionBox>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <SectionBox title="Tasks">
          <SimpleTable
            columns={[
              {
                label: 'Name',
                getter: (task: TaskState & { name: string }) => task.name,
              },
              {
                label: 'State',
                getter: (task: TaskState & { name: string }) => (
                  <StatusChip status={task.State} />
                ),
              },
              {
                label: 'Failed',
                getter: (task: TaskState & { name: string }) => (
                  task.Failed ? (
                    <StatusChip status="failed" label="Yes" />
                  ) : (
                    <StatusChip status="running" label="No" />
                  )
                ),
              },
              {
                label: 'Restarts',
                getter: (task: TaskState & { name: string }) => task.Restarts,
              },
              {
                label: 'Started',
                getter: (task: TaskState & { name: string }) => (
                  task.StartedAt ? (
                    <DateLabel date={new Date(task.StartedAt)} />
                  ) : (
                    '-'
                  )
                ),
              },
              {
                label: 'Actions',
                getter: (task: TaskState & { name: string }) => (
                  <Button
                    size="small"
                    startIcon={<RestartAltIcon />}
                    onClick={() => handleRestart(task.name)}
                  >
                    Restart
                  </Button>
                ),
              },
            ]}
            data={taskStates}
            emptyMessage="No tasks found"
          />
        </SectionBox>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 280px)', minHeight: 400 }}>
          {/* Horizontal task selector */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              p: 1,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              flexWrap: 'wrap',
            }}
          >
            {taskStates.map((task) => (
              <Button
                key={task.name}
                variant={selectedTask === task.name ? 'contained' : 'outlined'}
                onClick={() => setSelectedTask(task.name)}
                size="small"
                sx={{
                  textTransform: 'none',
                  borderRadius: 1,
                }}
              >
                {task.name}
                <Box sx={{ ml: 1 }}>
                  <StatusChip status={task.State} showIcon={false} />
                </Box>
              </Button>
            ))}
          </Box>

          {/* Full-width logs area */}
          <Box sx={{ flexGrow: 1, minHeight: 0 }}>
            {selectedTask && id ? (
              <TaskLogs allocId={id} taskName={selectedTask} />
            ) : (
              <Paper sx={{ p: 3, textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="textSecondary">
                  "Select a task to view logs"
                </Typography>
              </Paper>
            )}
          </Box>
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 280px)', minHeight: 400 }}>
          {/* Horizontal task selector */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              p: 1,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              flexWrap: 'wrap',
            }}
          >
            {taskStates.map((task) => (
              <Button
                key={task.name}
                variant={selectedTask === task.name ? 'contained' : 'outlined'}
                onClick={() => setSelectedTask(task.name)}
                size="small"
                sx={{
                  textTransform: 'none',
                  borderRadius: 1,
                }}
              >
                {task.name}
                <Box sx={{ ml: 1 }}>
                  <StatusChip status={task.State} showIcon={false} />
                </Box>
              </Button>
            ))}
          </Box>

          {/* Exec terminal area */}
          <Box sx={{ flexGrow: 1, minHeight: 0 }}>
            {selectedTask && id ? (
              <TaskExec
                allocId={id}
                taskName={selectedTask}
                onClose={() => setSelectedTask(null)}
              />
            ) : (
              <Paper sx={{ p: 3, textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="textSecondary">
                  Select a task to open a terminal
                </Typography>
              </Paper>
            )}
          </Box>
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <Grid container spacing={3}>
          {stats?.ResourceUsage && (
            <>
              <Grid size={{ xs: 12, md: 6 }}>
                <SectionBox title="CPU Usage">
                  <NameValueTable
                    rows={[
                      {
                        name: 'Total Ticks',
                        value: stats.ResourceUsage.CpuStats?.TotalTicks?.toFixed(2) || '-',
                      },
                      {
                        name: 'Percent',
                        value: `${stats.ResourceUsage.CpuStats?.Percent?.toFixed(2) || 0}%`,
                      },
                      {
                        name: 'User Mode',
                        value: `${stats.ResourceUsage.CpuStats?.UserMode?.toFixed(2) || 0}%`,
                      },
                      {
                        name: 'System Mode',
                        value: `${stats.ResourceUsage.CpuStats?.SystemMode?.toFixed(2) || 0}%`,
                      },
                    ]}
                  />
                </SectionBox>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <SectionBox title="Memory Usage">
                  <NameValueTable
                    rows={[
                      {
                        name: 'RSS',
                        value: `${((stats.ResourceUsage.MemoryStats?.RSS || 0) / 1024 / 1024).toFixed(2)} MB`,
                      },
                      {
                        name: 'Cache',
                        value: `${((stats.ResourceUsage.MemoryStats?.Cache || 0) / 1024 / 1024).toFixed(2)} MB`,
                      },
                      {
                        name: 'Swap',
                        value: `${((stats.ResourceUsage.MemoryStats?.Swap || 0) / 1024 / 1024).toFixed(2)} MB`,
                      },
                      {
                        name: 'Max Usage',
                        value: `${((stats.ResourceUsage.MemoryStats?.MaxUsage || 0) / 1024 / 1024).toFixed(2)} MB`,
                      },
                    ]}
                  />
                </SectionBox>
              </Grid>
            </>
          )}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={5}>
        {taskStates.map((task) => (
          <SectionBox key={task.name} title={`${task.name} Events`}>
            <SimpleTable
              columns={[
                {
                  label: 'Time',
                  getter: (event) => (
                    <DateLabel date={new Date(event.Time / 1000000)} />
                  ),
                },
                {
                  label: 'Type',
                  getter: (event) => event.Type,
                },
                {
                  label: 'Message',
                  getter: (event) => event.DisplayMessage || event.Message || '-',
                },
              ]}
              data={task.Events || []}
              emptyMessage="No events"
            />
          </SectionBox>
        ))}
      </TabPanel>
    </>
  );
}
