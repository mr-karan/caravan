import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Link,
  Box,
  IconButton,
  Tooltip,
  Typography,
  TextField,
  InputAdornment,
  Paper,
  Skeleton,
  alpha,
  useTheme,
} from '@mui/material';
import { Icon } from '@iconify/react';
import { SimpleTable, ErrorPage } from '../../common';
import { listNodes } from '../../../lib/nomad/api';
import { NodeListStub } from '../../../lib/nomad/types';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { MinimalStatus, minimalStatusColors } from '../statusStyles';

export default function NodeList() {
  const theme = useTheme();
  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;
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

  const stats = useMemo(() => {
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
    return (
      <Box sx={{ pb: 3 }}>
        <Skeleton variant="rectangular" height={50} sx={{ borderRadius: 1, mb: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  if (error) {
    return <ErrorPage message="Error loading nodes" error={error} />;
  }

  return (
    <Box sx={{ pb: 3 }}>
      {/* Compact Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          pb: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
            Nodes
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.8rem' }}>
            {stats.total}
          </Typography>
        </Box>

        {/* Inline Stats */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
            <Typography variant="caption" sx={{ color: colors.success, fontWeight: 600, fontSize: '0.8rem' }}>
              {stats.ready}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>ready</Typography>
          </Box>
          {stats.down > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
              <Typography variant="caption" sx={{ color: colors.error, fontWeight: 600, fontSize: '0.8rem' }}>
                {stats.down}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>down</Typography>
            </Box>
          )}
          {stats.draining > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
              <Typography variant="caption" sx={{ color: colors.pending, fontWeight: 600, fontSize: '0.8rem' }}>
                {stats.draining}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>draining</Typography>
            </Box>
          )}
          {stats.ineligible > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.8rem' }}>
                {stats.ineligible}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>ineligible</Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Icon icon="mdi:magnify" width={18} color={theme.palette.text.secondary} />
              </InputAdornment>
            ),
            sx: { fontSize: '0.8rem', py: 0 },
          }}
          sx={{ minWidth: 200, maxWidth: 300, '& .MuiInputBase-input': { py: 0.75 } }}
        />

        <Tooltip title="Refresh">
          <IconButton onClick={loadNodes} size="small" sx={{ p: 0.75 }}>
            <Icon icon="mdi:refresh" width={18} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Table */}
      <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
        <SimpleTable
          columns={[
            {
              label: 'Name',
              getter: (node: NodeListStub) => (
                <Box>
                  <Link
                    component={RouterLink}
                    to={createRouteURL('nomadNode', { id: node.ID })}
                    sx={{ fontWeight: 500, fontSize: '0.85rem' }}
                  >
                    {node.Name}
                  </Link>
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', fontFamily: 'monospace', fontSize: '0.65rem' }}>
                    {node.ID.substring(0, 8)}
                  </Typography>
                </Box>
              ),
            },
            {
              label: 'Datacenter',
              getter: (node: NodeListStub) => (
                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>{node.Datacenter}</Typography>
              ),
            },
            {
              label: 'Address',
              getter: (node: NodeListStub) => (
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{node.Address}</Typography>
              ),
            },
            {
              label: 'Status',
              getter: (node: NodeListStub) => (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <MinimalStatus status={node.Status} />
                  {node.Drain && (
                    <Typography variant="caption" sx={{ color: colors.pending, fontSize: '0.65rem' }}>draining</Typography>
                  )}
                  {node.SchedulingEligibility === 'ineligible' && (
                    <Typography variant="caption" sx={{ color: colors.error, fontSize: '0.65rem' }}>ineligible</Typography>
                  )}
                </Box>
              ),
            },
            {
              label: 'Class',
              getter: (node: NodeListStub) => (
                node.NodeClass ? (
                  <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>{node.NodeClass}</Typography>
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                )
              ),
            },
            {
              label: 'Pool',
              getter: (node: NodeListStub) => (
                node.NodePool ? (
                  <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>{node.NodePool}</Typography>
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>default</Typography>
                )
              ),
            },
            {
              label: 'Version',
              getter: (node: NodeListStub) => (
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'text.secondary' }}>
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
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'text.secondary' }}>
                    {cpu} MHz · {mem} MB
                  </Typography>
                );
              },
            },
          ]}
          data={filteredNodes}
          emptyMessage="No nodes found"
        />
      </Paper>
    </Box>
  );
}
