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
  Collapse,
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
import { getNode, getNodeAllocations, setNodeEligibility, drainNode } from '../../../lib/nomad/api';
import { Node, AllocationListStub } from '../../../lib/nomad/types';
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

// Resource card component with visual indicator
function ResourceCard({
  icon,
  label,
  value,
  total,
  unit,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  total?: number;
  unit: string;
  color: string;
}) {
  const theme = useTheme();
  const percentage = total ? Math.min((value / total) * 100, 100) : 100;

  // Format large numbers
  const formatValue = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toString();
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
          {formatValue(value)}{' '}
          <Typography component="span" variant="body2" color="text.secondary">
            {unit}
          </Typography>
        </Typography>

        {total && (
          <LinearProgress
            variant="determinate"
            value={percentage}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: alpha(color, 0.1),
              '& .MuiLinearProgress-bar': {
                backgroundColor: color,
                borderRadius: 3,
              },
            }}
          />
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
          fontWeight: 500,
          fontSize: '0.875rem',
          ...(mono ? { fontFamily: 'monospace', fontSize: '0.8rem' } : {}),
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

// Driver row component
function DriverRow({ name, info }: { name: string; info: any }) {
  const theme = useTheme();
  const isHealthy = info.Healthy;
  const isDetected = info.Detected;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1.5,
        px: 2,
        borderRadius: 1.5,
        backgroundColor: alpha(
          isHealthy ? theme.palette.success.main : theme.palette.error.main,
          0.04
        ),
        border: `1px solid ${alpha(
          isHealthy ? theme.palette.success.main : theme.palette.error.main,
          0.15
        )}`,
        mb: 1,
        '&:last-child': { mb: 0 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Icon
          icon={isHealthy ? 'mdi:check-circle' : 'mdi:alert-circle'}
          width={20}
          color={isHealthy ? theme.palette.success.main : theme.palette.error.main}
        />
        <Typography variant="body2" fontWeight={600}>
          {name}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Chip
          size="small"
          label={isDetected ? 'Detected' : 'Not Detected'}
          sx={{
            backgroundColor: alpha(
              isDetected ? theme.palette.success.main : theme.palette.grey[500],
              0.1
            ),
            color: isDetected ? theme.palette.success.main : theme.palette.grey[500],
            fontWeight: 500,
            fontSize: '0.7rem',
          }}
        />
        {info.HealthDescription && (
          <Tooltip title={info.HealthDescription}>
            <Icon icon="mdi:information-outline" width={16} color={theme.palette.text.secondary} />
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

export default function NodeDetails() {
  const theme = useTheme();
  const { id } = useParams<{ id: string }>();
  const [node, setNode] = useState<Node | null>(null);
  const [allocations, setAllocations] = useState<AllocationListStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [metaExpanded, setMetaExpanded] = useState(false);

  useEffect(() => {
    loadNode();
  }, [id]);

  async function loadNode() {
    if (!id) return;

    try {
      setLoading(true);
      const [nodeData, allocsData] = await Promise.all([
        getNode(id),
        getNodeAllocations(id).catch(() => []),
      ]);
      setNode(nodeData);
      setAllocations(allocsData || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleEligibility() {
    if (!node) return;
    try {
      const newEligibility = node.SchedulingEligibility !== 'eligible';
      await setNodeEligibility(node.ID, newEligibility);
      loadNode();
    } catch (err) {
      console.error('Failed to toggle eligibility:', err);
    }
  }

  async function handleDrain() {
    if (!node) return;
    try {
      await drainNode(node.ID, !node.Drain);
      loadNode();
    } catch (err) {
      console.error('Failed to toggle drain:', err);
    }
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2, mb: 3 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Icon icon="mdi:alert-circle" width={48} color={theme.palette.error.main} />
        <Typography color="error" sx={{ mt: 2 }}>
          Error loading node: {error.message}
        </Typography>
        <Button onClick={loadNode} sx={{ mt: 2 }}>
          Retry
        </Button>
      </Box>
    );
  }

  if (!node) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">Node not found</Typography>
      </Box>
    );
  }

  // Format resources
  const cpuMHz = node.NodeResources?.Cpu?.CpuShares || 0;
  const memoryMB = node.NodeResources?.Memory?.MemoryMB || 0;
  const diskMB = node.NodeResources?.Disk?.DiskMB || 0;

  const statusColor =
    node.Status === 'ready'
      ? theme.palette.success.main
      : node.Status === 'down'
        ? theme.palette.error.main
        : theme.palette.warning.main;

  const metaEntries = node.Meta ? Object.entries(node.Meta) : [];

  return (
    <Box>
      {/* Header Section */}
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
            {/* Status indicator */}
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
                icon={node.Status === 'ready' ? 'mdi:server' : 'mdi:server-off'}
                width={28}
                color={statusColor}
              />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                <Typography variant="h5" fontWeight={600}>
                  {node.Name}
                </Typography>
                <StatusChip status={node.Status} />
                {node.Drain && (
                  <Chip
                    size="small"
                    icon={<Icon icon="mdi:water-off" width={14} />}
                    label="Draining"
                    color="warning"
                    sx={{ fontWeight: 500 }}
                  />
                )}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <Icon icon="mdi:map-marker" width={16} />
                  {node.Datacenter}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <Icon icon="mdi:ip-network" width={16} />
                  {node.HTTPAddr}
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
                  {node.ID.substring(0, 8)}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={loadNode} size="small">
                <Icon icon="mdi:refresh" width={20} />
              </IconButton>
            </Tooltip>
            <Button
              onClick={handleToggleEligibility}
              variant="outlined"
              size="small"
              color={node.SchedulingEligibility === 'eligible' ? 'warning' : 'success'}
              startIcon={
                <Icon
                  icon={
                    node.SchedulingEligibility === 'eligible'
                      ? 'mdi:close-circle-outline'
                      : 'mdi:check-circle-outline'
                  }
                  width={18}
                />
              }
            >
              {node.SchedulingEligibility === 'eligible' ? 'Mark Ineligible' : 'Mark Eligible'}
            </Button>
            <Button
              onClick={handleDrain}
              variant="outlined"
              size="small"
              color={node.Drain ? 'success' : 'warning'}
              startIcon={
                <Icon icon={node.Drain ? 'mdi:water' : 'mdi:water-off'} width={18} />
              }
            >
              {node.Drain ? 'Stop Drain' : 'Start Drain'}
            </Button>
          </Box>
        </Box>
      </Paper>

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
            label={`Allocations (${allocations.length})`}
            icon={<Icon icon="mdi:cube-outline" width={18} />}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
          <Tab
            label="Attributes"
            icon={<Icon icon="mdi:tag-multiple-outline" width={18} />}
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
        {/* Resources */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
          RESOURCES
        </Typography>
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ResourceCard
              icon="mdi:chip"
              label="CPU"
              value={cpuMHz}
              unit="MHz"
              color={theme.palette.info.main}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ResourceCard
              icon="mdi:memory"
              label="Memory"
              value={memoryMB}
              unit="MB"
              color={theme.palette.success.main}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ResourceCard
              icon="mdi:harddisk"
              label="Disk"
              value={diskMB}
              unit="MB"
              color={theme.palette.warning.main}
            />
          </Grid>
        </Grid>

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
              <DetailRow label="ID" value={node.ID} mono />
              <DetailRow label="Name" value={node.Name} />
              <DetailRow label="Datacenter" value={node.Datacenter} />
              <DetailRow
                label="Status"
                value={<StatusChip status={node.Status} />}
              />
              <DetailRow
                label="Eligibility"
                value={
                  <StatusChip
                    status={node.SchedulingEligibility === 'eligible' ? 'running' : 'ineligible'}
                    label={node.SchedulingEligibility}
                  />
                }
              />
              <DetailRow label="Node Class" value={node.NodeClass || '—'} />
              <DetailRow label="Address" value={node.HTTPAddr} mono />
              <DetailRow
                label="TLS Enabled"
                value={
                  <Chip
                    size="small"
                    label={node.TLSEnabled ? 'Yes' : 'No'}
                    color={node.TLSEnabled ? 'success' : 'default'}
                    sx={{ fontWeight: 500, fontSize: '0.7rem' }}
                  />
                }
              />
            </Paper>
          </Grid>

          {/* Drivers */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
              DRIVERS
            </Typography>
            <Paper
              elevation={0}
              sx={{ p: 2, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}
            >
              {node.Drivers && Object.keys(node.Drivers).length > 0 ? (
                Object.entries(node.Drivers).map(([name, info]) => (
                  <DriverRow key={name} name={name} info={info} />
                ))
              ) : (
                <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  No drivers available
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Metadata */}
        {metaEntries.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                METADATA ({metaEntries.length})
              </Typography>
              <Button
                size="small"
                onClick={() => setMetaExpanded(!metaExpanded)}
                endIcon={
                  <Icon icon={metaExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'} width={18} />
                }
              >
                {metaExpanded ? 'Collapse' : 'Expand'}
              </Button>
            </Box>

            <Collapse in={metaExpanded}>
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
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  }}
                >
                  {metaEntries.sort(([a], [b]) => a.localeCompare(b)).map(([key, value], idx) => (
                    <Box
                      key={key}
                      sx={{
                        p: 2,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        borderRight: `1px solid ${theme.palette.divider}`,
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.02),
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mb: 0.5 }}
                      >
                        {key}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          wordBreak: 'break-all',
                        }}
                      >
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
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                {metaEntries.slice(0, 6).map(([key]) => (
                  <Chip
                    key={key}
                    size="small"
                    label={key}
                    sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                  />
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
          </Box>
        )}
      </TabPanel>

      {/* Allocations Tab */}
      <TabPanel value={tabValue} index={1}>
        <Paper
          elevation={0}
          sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}
        >
          {allocations.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Icon icon="mdi:cube-off-outline" width={48} color={theme.palette.text.disabled} />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                No allocations on this node
              </Typography>
            </Box>
          ) : (
            <SimpleTable
              columns={[
                {
                  label: 'ID',
                  getter: alloc => (
                    <Link
                      component={RouterLink}
                      to={createRouteURL('nomadAllocation', { id: alloc.ID })}
                      sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                    >
                      {alloc.ID.substring(0, 8)}
                    </Link>
                  ),
                },
                { label: 'Name', getter: alloc => alloc.Name },
                {
                  label: 'Job',
                  getter: alloc => (
                    <Link
                      component={RouterLink}
                      to={createRouteURL('nomadJob', {
                        namespace: alloc.Namespace || 'default',
                        name: alloc.JobID,
                      })}
                    >
                      {alloc.JobID}
                    </Link>
                  ),
                },
                { label: 'Task Group', getter: alloc => alloc.TaskGroup },
                {
                  label: 'Status',
                  getter: alloc => <StatusChip status={alloc.ClientStatus} />,
                },
              ]}
              data={allocations}
            />
          )}
        </Paper>
      </TabPanel>

      {/* Attributes Tab */}
      <TabPanel value={tabValue} index={2}>
        <Paper
          elevation={0}
          sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}
        >
          {node.Attributes && Object.keys(node.Attributes).length > 0 ? (
            <SimpleTable
              columns={[
                {
                  label: 'Key',
                  getter: attr => (
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {attr.key}
                    </Typography>
                  ),
                },
                {
                  label: 'Value',
                  getter: attr => (
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {attr.value}
                    </Typography>
                  ),
                },
              ]}
              data={Object.entries(node.Attributes)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => ({ key, value }))}
            />
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Icon icon="mdi:tag-off-outline" width={48} color={theme.palette.text.disabled} />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                No attributes
              </Typography>
            </Box>
          )}
        </Paper>
      </TabPanel>

      {/* Events Tab */}
      <TabPanel value={tabValue} index={3}>
        <Paper
          elevation={0}
          sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}
        >
          {node.Events && node.Events.length > 0 ? (
            <SimpleTable
              columns={[
                {
                  label: 'Time',
                  getter: event =>
                    event.Timestamp ? (
                      <DateLabel date={new Date(event.Timestamp / 1000000)} />
                    ) : (
                      '—'
                    ),
                },
                {
                  label: 'Subsystem',
                  getter: event => (
                    <Chip
                      size="small"
                      label={event.Subsystem}
                      sx={{ fontWeight: 500, fontSize: '0.7rem' }}
                    />
                  ),
                },
                {
                  label: 'Message',
                  getter: event => event.Message,
                },
              ]}
              data={[...node.Events].reverse()}
            />
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Icon icon="mdi:history" width={48} color={theme.palette.text.disabled} />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                No events
              </Typography>
            </Box>
          )}
        </Paper>
      </TabPanel>
    </Box>
  );
}
