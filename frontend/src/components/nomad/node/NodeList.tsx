import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Link,
  Chip,
  Box,
  IconButton,
  Tooltip,
  Typography,
  TextField,
  InputAdornment,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import StorageIcon from '@mui/icons-material/Storage';
import DnsIcon from '@mui/icons-material/Dns';
import { SectionBox, SimpleTable, Loader, ErrorPage } from '../../common';
import { listNodes } from '../../../lib/nomad/api';
import { NodeListStub } from '../../../lib/nomad/types';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { StatusChip, statusColors } from '../statusStyles';
import { CopyableIP, CopyableId } from '../CopyButton';

// Node role indicator (shows if node is a server/leader based on attributes)
function NodeRoleChip({ node }: { node: NodeListStub }) {
  // Note: NodeListStub doesn't include detailed attributes, but we can infer from other data
  // In a real scenario, you might need to fetch node details or check server members
  return null; // Will be enhanced when we have more node info
}

// Get node pool color based on pool name for visual distinction
function getNodePoolColor(pool: string): string {
  const colors = [
    '#1976d2', // blue
    '#388e3c', // green
    '#f57c00', // orange
    '#7b1fa2', // purple
    '#0097a7', // cyan
    '#c2185b', // pink
  ];
  let hash = 0;
  for (let i = 0; i < pool.length; i++) {
    hash = pool.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Summary stats for nodes
interface NodeStats {
  total: number;
  ready: number;
  down: number;
  draining: number;
  ineligible: number;
}

function NodeStatsSummary({ stats }: { stats: NodeStats }) {
  return (
    <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
      <Tooltip title="Total nodes">
        <Chip
          icon={<StorageIcon sx={{ fontSize: 16 }} />}
          label={stats.total}
          size="small"
          variant="outlined"
        />
      </Tooltip>
      {stats.ready > 0 && (
        <Tooltip title="Ready nodes">
          <Chip
            label={`${stats.ready} ready`}
            size="small"
            sx={{
              backgroundColor: statusColors.success.background,
              color: statusColors.success.color,
              border: `1px solid ${statusColors.success.border}`,
            }}
          />
        </Tooltip>
      )}
      {stats.down > 0 && (
        <Tooltip title="Down nodes">
          <Chip
            label={`${stats.down} down`}
            size="small"
            sx={{
              backgroundColor: statusColors.error.background,
              color: statusColors.error.color,
              border: `1px solid ${statusColors.error.border}`,
            }}
          />
        </Tooltip>
      )}
      {stats.draining > 0 && (
        <Tooltip title="Draining nodes">
          <Chip
            label={`${stats.draining} draining`}
            size="small"
            sx={{
              backgroundColor: statusColors.warning.background,
              color: statusColors.warning.color,
              border: `1px solid ${statusColors.warning.border}`,
            }}
          />
        </Tooltip>
      )}
      {stats.ineligible > 0 && (
        <Tooltip title="Ineligible for scheduling">
          <Chip
            label={`${stats.ineligible} ineligible`}
            size="small"
            sx={{
              backgroundColor: statusColors.cancelled.background,
              color: statusColors.cancelled.color,
              border: `1px solid ${statusColors.cancelled.border}`,
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
}

export default function NodeList() {
  const [nodes, setNodes] = useState<NodeListStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadNodes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listNodes();
      setNodes(data || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  // Calculate stats
  const stats = useMemo<NodeStats>(() => {
    return nodes.reduce(
      (acc, node) => {
        acc.total++;
        if (node.Status === 'ready') acc.ready++;
        if (node.Status === 'down') acc.down++;
        if (node.Drain) acc.draining++;
        if (node.SchedulingEligibility === 'ineligible') acc.ineligible++;
        return acc;
      },
      { total: 0, ready: 0, down: 0, draining: 0, ineligible: 0 }
    );
  }, [nodes]);

  // Filter nodes based on search
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const query = searchQuery.toLowerCase();
    return nodes.filter(
      node =>
        node.Name.toLowerCase().includes(query) ||
        node.ID.toLowerCase().includes(query) ||
        node.Address.toLowerCase().includes(query) ||
        node.Datacenter.toLowerCase().includes(query) ||
        node.NodeClass?.toLowerCase().includes(query) ||
        node.Status.toLowerCase().includes(query)
    );
  }, [nodes, searchQuery]);

  if (loading) {
    return <Loader title="Loading nodes..." />;
  }

  if (error) {
    return <ErrorPage message="Error loading nodes" error={error} />;
  }

  return (
    <SectionBox
      title={
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h5" component="span">
            Nodes
          </Typography>
          <NodeStatsSummary stats={stats} />
        </Box>
      }
      headerProps={{
        actions: [
          <TextField
            key="search"
            size="small"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 200 }}
          />,
          <Tooltip key="refresh" title="Refresh">
            <IconButton onClick={loadNodes} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>,
        ],
      }}
    >
      <SimpleTable
        columns={[
          {
            label: 'Name',
            getter: (node: NodeListStub) => (
              <Box>
                <Link
                  component={RouterLink}
                  to={createRouteURL('nomadNode', { id: node.ID })}
                  sx={{ fontWeight: 500 }}
                >
                  {node.Name}
                </Link>
                <Typography
                  variant="caption"
                  display="block"
                  color="text.secondary"
                  sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                >
                  {node.ID.substring(0, 8)}
                </Typography>
              </Box>
            ),
          },
          {
            label: 'Datacenter',
            getter: (node: NodeListStub) => (
              <Chip
                label={node.Datacenter}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            ),
          },
          {
            label: 'Address',
            getter: (node: NodeListStub) => <CopyableIP ip={node.Address} />,
          },
          {
            label: 'Status',
            getter: (node: NodeListStub) => (
              <Box display="flex" gap={0.5} flexWrap="wrap">
                <StatusChip status={node.Status} />
                {node.Drain && <StatusChip status="draining" showIcon={false} />}
                {node.SchedulingEligibility === 'ineligible' && (
                  <StatusChip status="ineligible" label="Ineligible" showIcon={false} />
                )}
              </Box>
            ),
          },
          {
            label: 'Node Class',
            getter: (node: NodeListStub) =>
              node.NodeClass ? (
                <Chip label={node.NodeClass} size="small" variant="outlined" />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  -
                </Typography>
              ),
          },
          {
            label: 'Node Pool',
            getter: (node: NodeListStub) =>
              node.NodePool ? (
                <Chip
                  label={node.NodePool}
                  size="small"
                  sx={{
                    backgroundColor: `${getNodePoolColor(node.NodePool)}15`,
                    color: getNodePoolColor(node.NodePool),
                    border: `1px solid ${getNodePoolColor(node.NodePool)}`,
                  }}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  default
                </Typography>
              ),
          },
          {
            label: 'Version',
            getter: (node: NodeListStub) => (
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {node.Version}
              </Typography>
            ),
          },
          {
            label: 'Resources',
            getter: (node: NodeListStub) => {
              const cpu = node.NodeResources?.Cpu?.CpuShares || 0;
              const mem = node.NodeResources?.Memory?.MemoryMB || 0;
              return (
                <Box>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                    CPU: {cpu} MHz
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                    Mem: {Math.round(mem / 1024)} GB
                  </Typography>
                </Box>
              );
            },
          },
        ]}
        data={filteredNodes}
        emptyMessage="No nodes found"
      />
    </SectionBox>
  );
}
