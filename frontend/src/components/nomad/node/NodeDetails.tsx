import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  alpha,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
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

// Compact stat item
function StatItem({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | string;
  unit?: string;
}) {
  return (
    <Box sx={{ minWidth: 80 }}>
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
            color: 'text.primary',
            lineHeight: 1.2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Typography>
        {unit && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
            {unit}
          </Typography>
        )}
      </Box>
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

// Compact driver row
function DriverRow({ name, info }: { name: string; info: any }) {
  const theme = useTheme();
  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;
  const isHealthy = info.Healthy;
  const isDetected = info.Detected;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 80px 80px',
        gap: 2,
        py: 0.75,
        px: 1.5,
        borderBottom: `1px solid ${theme.palette.divider}`,
        '&:last-child': { borderBottom: 'none' },
        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.02) },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: isHealthy ? colors.success : colors.error,
          }}
        />
        <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
          {name}
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: isDetected ? colors.success : 'text.disabled', fontSize: '0.7rem' }}>
        {isDetected ? 'detected' : 'not detected'}
      </Typography>
      <Typography variant="caption" sx={{ color: isHealthy ? colors.success : colors.error, fontSize: '0.7rem', textAlign: 'right' }}>
        {isHealthy ? 'healthy' : 'unhealthy'}
      </Typography>
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

  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;

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
        <Button onClick={loadNode} size="small" sx={{ mt: 1 }}>
          Retry
        </Button>
      </Box>
    );
  }

  if (!node) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">Node not found</Typography>
      </Box>
    );
  }

  const cpuMHz = node.NodeResources?.Cpu?.CpuShares || 0;
  const memoryMB = node.NodeResources?.Memory?.MemoryMB || 0;
  const diskMB = node.NodeResources?.Disk?.DiskMB || 0;

  const statusCategory = getStatusCategory(node.Status);
  const statusColor = colors[statusCategory];

  const metaEntries = node.Meta ? Object.entries(node.Meta) : [];
  const runningAllocs = allocations.filter(a => a.ClientStatus === 'running').length;

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
              {node.Name}
            </Typography>
            <MinimalStatus status={node.Status} />
            {node.Drain && (
              <Typography variant="caption" sx={{ color: colors.pending, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Icon icon="mdi:water-off" width={14} />
                draining
              </Typography>
            )}
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
              {node.ID.substring(0, 8)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Icon icon="mdi:map-marker" width={14} />
              {node.Datacenter}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Icon icon="mdi:ip-network" width={14} />
              {node.HTTPAddr}
            </Typography>
            {node.NodeClass && (
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
                {node.NodeClass}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadNode} size="small" sx={{ p: 0.75 }}>
              <Icon icon="mdi:refresh" width={18} />
            </IconButton>
          </Tooltip>
          <Button
            onClick={handleToggleEligibility}
            size="small"
            color={node.SchedulingEligibility === 'eligible' ? 'warning' : 'success'}
            sx={{ minWidth: 'auto', px: 1.5, py: 0.5, fontSize: '0.75rem' }}
          >
            {node.SchedulingEligibility === 'eligible' ? 'Ineligible' : 'Eligible'}
          </Button>
          <Button
            onClick={handleDrain}
            size="small"
            color={node.Drain ? 'success' : 'warning'}
            sx={{ minWidth: 'auto', px: 1.5, py: 0.5, fontSize: '0.75rem' }}
          >
            {node.Drain ? 'Stop Drain' : 'Drain'}
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
        }}
      >
        <StatItem label="CPU" value={cpuMHz} unit="MHz" />
        <StatItem label="Memory" value={memoryMB} unit="MB" />
        <StatItem label="Disk" value={diskMB} unit="MB" />
        <StatItem label="Allocations" value={allocations.length} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: colors.success, fontWeight: 500, fontSize: '0.8rem' }}>
            {runningAllocs}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
            running
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
            Eligibility:
          </Typography>
          <MinimalStatus status={node.SchedulingEligibility === 'eligible' ? 'running' : 'ineligible'} label={node.SchedulingEligibility} />
        </Box>
      </Box>

      {/* Tabs - compact */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, px: 1.5, fontSize: '0.8rem' } }}
        >
          <Tab label="Overview" icon={<Icon icon="mdi:view-dashboard-outline" width={16} />} iconPosition="start" />
          <Tab label={`Allocations (${allocations.length})`} icon={<Icon icon="mdi:cube-outline" width={16} />} iconPosition="start" />
          <Tab label="Attributes" icon={<Icon icon="mdi:tag-multiple-outline" width={16} />} iconPosition="start" />
          <Tab label="Events" icon={<Icon icon="mdi:history" width={16} />} iconPosition="start" />
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
              <DetailRow label="ID" value={<Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{node.ID}</Typography>} />
              <DetailRow label="Name" value={node.Name} />
              <DetailRow label="Datacenter" value={node.Datacenter} />
              <DetailRow label="Status" value={<MinimalStatus status={node.Status} />} />
              <DetailRow label="Eligibility" value={<MinimalStatus status={node.SchedulingEligibility === 'eligible' ? 'running' : 'ineligible'} label={node.SchedulingEligibility} />} />
              <DetailRow label="Node Class" value={node.NodeClass || '—'} />
              <DetailRow label="Address" value={<Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{node.HTTPAddr}</Typography>} />
              <DetailRow label="TLS Enabled" value={node.TLSEnabled ? 'Yes' : 'No'} />
            </Paper>
          </Box>

          {/* Drivers */}
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
              Drivers
            </Typography>
            <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
              {node.Drivers && Object.keys(node.Drivers).length > 0 ? (
                <>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 80px 80px',
                      gap: 2,
                      py: 0.5,
                      px: 1.5,
                      backgroundColor: alpha(theme.palette.text.primary, 0.02),
                      borderBottom: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase' }}>Driver</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase' }}>Detected</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'right' }}>Health</Typography>
                  </Box>
                  {Object.entries(node.Drivers).map(([name, info]) => (
                    <DriverRow key={name} name={name} info={info} />
                  ))}
                </>
              ) : (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>No drivers available</Typography>
                </Box>
              )}
            </Paper>
          </Box>

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

      {/* Allocations Tab */}
      <TabPanel value={tabValue} index={1}>
        <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
          {allocations.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>No allocations on this node</Typography>
            </Box>
          ) : (
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
                { label: 'Name', getter: (alloc: AllocationListStub) => alloc.Name },
                {
                  label: 'Job',
                  getter: (alloc: AllocationListStub) => (
                    <Link component={RouterLink} to={createRouteURL('nomadJob', { namespace: alloc.Namespace || 'default', name: alloc.JobID })} sx={{ fontSize: '0.8rem' }}>
                      {alloc.JobID}
                    </Link>
                  ),
                },
                { label: 'Task Group', getter: (alloc: AllocationListStub) => alloc.TaskGroup },
                { label: 'Status', getter: (alloc: AllocationListStub) => <MinimalStatus status={alloc.ClientStatus} /> },
              ]}
              data={allocations}
            />
          )}
        </Paper>
      </TabPanel>

      {/* Attributes Tab */}
      <TabPanel value={tabValue} index={2}>
        <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
          {node.Attributes && Object.keys(node.Attributes).length > 0 ? (
            <SimpleTable
              columns={[
                {
                  label: 'Key',
                  getter: (attr: { key: string; value: string }) => (
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{attr.key}</Typography>
                  ),
                },
                {
                  label: 'Value',
                  getter: (attr: { key: string; value: string }) => (
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{attr.value}</Typography>
                  ),
                },
              ]}
              data={Object.entries(node.Attributes).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ key, value }))}
            />
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>No attributes</Typography>
            </Box>
          )}
        </Paper>
      </TabPanel>

      {/* Events Tab */}
      <TabPanel value={tabValue} index={3}>
        <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
          {node.Events && node.Events.length > 0 ? (
            <SimpleTable
              columns={[
                {
                  label: 'Time',
                  getter: (event: any) => event.Timestamp ? <DateLabel date={new Date(event.Timestamp / 1000000)} /> : '—',
                },
                {
                  label: 'Subsystem',
                  getter: (event: any) => (
                    <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>{event.Subsystem}</Typography>
                  ),
                },
                { label: 'Message', getter: (event: any) => event.Message },
              ]}
              data={[...node.Events].reverse()}
            />
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>No events</Typography>
            </Box>
          )}
        </Paper>
      </TabPanel>
    </Box>
  );
}
