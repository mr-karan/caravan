import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Link,
  IconButton,
  Tooltip,
  Box,
  Typography,
  TextField,
  InputAdornment,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import { SectionBox, SimpleTable, Loader, ErrorPage } from '../../common';
import { listAllocations } from '../../../lib/nomad/api';
import { AllocationListStub } from '../../../lib/nomad/types';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { useNamespace, ALL_NAMESPACES } from '../../../lib/nomad/namespaceContext';
import NamespaceSwitcher from '../NamespaceSwitcher';
import { MinimalStatus, AllocationCounts, InlineBadge } from '../statusStyles';
import { CopyableId } from '../CopyButton';

// Summary stats for allocations
interface AllocationStats {
  total: number;
  running: number;
  pending: number;
  failed: number;
  complete: number;
}

/**
 * Minimal stats summary - just numbers with semantic colors
 * Design: "24 total · 20 running · 3 pending · 1 failed"
 */
function AllocationStatsSummary({ stats }: { stats: AllocationStats }) {
  return (
    <Box display="flex" alignItems="center" gap={0.75}>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          fontSize: '0.8125rem',
        }}
      >
        {stats.total} total
      </Typography>
      {stats.total > 0 && (
        <>
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>·</Typography>
          <AllocationCounts
            running={stats.running}
            pending={stats.pending}
            failed={stats.failed}
            complete={stats.complete}
          />
        </>
      )}
    </Box>
  );
}

export default function AllocationList() {
  const { namespace } = useNamespace();
  const [allocations, setAllocations] = useState<AllocationListStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadAllocations = useCallback(async () => {
    try {
      setLoading(true);
      const params = namespace === ALL_NAMESPACES ? { namespace: '*' } : { namespace };
      const data = await listAllocations(params);
      setAllocations(data || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [namespace]);

  useEffect(() => {
    loadAllocations();
  }, [loadAllocations]);

  // Calculate stats
  const stats = useMemo<AllocationStats>(() => {
    return allocations.reduce(
      (acc, alloc) => {
        acc.total++;
        const status = alloc.ClientStatus.toLowerCase();
        if (status === 'running') acc.running++;
        else if (status === 'pending' || status === 'starting') acc.pending++;
        else if (status === 'failed' || status === 'lost') acc.failed++;
        else if (status === 'complete') acc.complete++;
        return acc;
      },
      { total: 0, running: 0, pending: 0, failed: 0, complete: 0 }
    );
  }, [allocations]);

  // Filter allocations based on search
  const filteredAllocations = useMemo(() => {
    if (!searchQuery.trim()) return allocations;
    const query = searchQuery.toLowerCase();
    return allocations.filter(
      alloc =>
        alloc.ID.toLowerCase().includes(query) ||
        alloc.JobID.toLowerCase().includes(query) ||
        alloc.TaskGroup.toLowerCase().includes(query) ||
        alloc.NodeID?.toLowerCase().includes(query) ||
        alloc.ClientStatus.toLowerCase().includes(query) ||
        alloc.Namespace?.toLowerCase().includes(query)
    );
  }, [allocations, searchQuery]);

  if (loading) {
    return <Loader title="Loading allocations..." />;
  }

  if (error) {
    return <ErrorPage message="Error loading allocations" error={error} />;
  }

  return (
    <SectionBox
      title={
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h5" component="span">
            Allocations
          </Typography>
          <AllocationStatsSummary stats={stats} />
        </Box>
      }
      headerProps={{
        actions: [
          <TextField
            key="search"
            size="small"
            placeholder="Search allocations..."
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
          <NamespaceSwitcher key="namespace" />,
          <Tooltip key="refresh" title="Refresh">
            <IconButton onClick={loadAllocations} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>,
        ],
      }}
    >
      <SimpleTable
        columns={[
          {
            label: 'ID',
            getter: (alloc: AllocationListStub) => (
              <Link
                component={RouterLink}
                to={createRouteURL('nomadAllocation', { id: alloc.ID })}
                sx={{ fontWeight: 500 }}
              >
                <CopyableId id={alloc.ID} />
              </Link>
            ),
          },
          {
            label: 'Status',
            getter: (alloc: AllocationListStub) => (
              <MinimalStatus status={alloc.ClientStatus} />
            ),
            gridTemplate: 'auto',
          },
          {
            label: 'Job',
            getter: (alloc: AllocationListStub) => (
              <Link
                component={RouterLink}
                to={createRouteURL('nomadJob', {
                  name: alloc.JobID,
                  namespace: alloc.Namespace || 'default',
                })}
              >
                {alloc.JobID}
              </Link>
            ),
          },
          {
            label: 'Task Group',
            getter: (alloc: AllocationListStub) => (
              <Typography variant="body2" sx={{ color: 'text.primary' }}>
                {alloc.TaskGroup}
              </Typography>
            ),
          },
          {
            label: 'Namespace',
            getter: (alloc: AllocationListStub) => (
              <InlineBadge>{alloc.Namespace || 'default'}</InlineBadge>
            ),
            gridTemplate: 'auto',
          },
          {
            label: 'Node',
            getter: (alloc: AllocationListStub) =>
              alloc.NodeID ? (
                <Link
                  component={RouterLink}
                  to={createRouteURL('nomadNode', { id: alloc.NodeID })}
                  sx={{ fontSize: '0.8125rem' }}
                >
                  <CopyableId id={alloc.NodeID} />
                </Link>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  —
                </Typography>
              ),
          },
          {
            label: 'Age',
            getter: (alloc: AllocationListStub) =>
              alloc.CreateTime ? (
                <DateLabel date={new Date(alloc.CreateTime / 1000000)} />
              ) : (
                '—'
              ),
            gridTemplate: 'auto',
          },
        ]}
        data={filteredAllocations}
        emptyMessage="No allocations found"
      />
    </SectionBox>
  );
}
