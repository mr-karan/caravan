import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getCluster } from '../../lib/cluster';
import { createRouteURL } from '../../lib/router/createRouteURL';
import { useTypedSelector } from '../../redux/hooks';
import ClusterAvatar from '../common/ClusterAvatar';

interface SearchResult {
  cluster: string;
  type: 'job' | 'node' | 'allocation';
  id: string;
  name: string;
  status: string;
  namespace?: string;
}

async function searchCluster(
  clusterName: string,
  query: string
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  try {
    // Search jobs
    const jobsRes = await fetch(`/api/clusters/${encodeURIComponent(clusterName)}/v1/jobs`);
    if (jobsRes.ok) {
      const jobs = await jobsRes.json();
      jobs?.forEach((job: any) => {
        if (
          job.Name?.toLowerCase().includes(queryLower) ||
          job.ID?.toLowerCase().includes(queryLower)
        ) {
          results.push({
            cluster: clusterName,
            type: 'job',
            id: job.ID,
            name: job.Name,
            status: job.Status,
            namespace: job.Namespace,
          });
        }
      });
    }

    // Search nodes
    const nodesRes = await fetch(`/api/clusters/${encodeURIComponent(clusterName)}/v1/nodes`);
    if (nodesRes.ok) {
      const nodes = await nodesRes.json();
      nodes?.forEach((node: any) => {
        if (
          node.Name?.toLowerCase().includes(queryLower) ||
          node.ID?.toLowerCase().includes(queryLower)
        ) {
          results.push({
            cluster: clusterName,
            type: 'node',
            id: node.ID,
            name: node.Name,
            status: node.Status,
          });
        }
      });
    }

    // Search allocations (by ID prefix)
    if (query.length >= 4) {
      const allocsRes = await fetch(`/api/clusters/${encodeURIComponent(clusterName)}/v1/allocations`);
      if (allocsRes.ok) {
        const allocs = await allocsRes.json();
        allocs?.slice(0, 100).forEach((alloc: any) => {
          if (alloc.ID?.toLowerCase().startsWith(queryLower)) {
            results.push({
              cluster: clusterName,
              type: 'allocation',
              id: alloc.ID,
              name: `${alloc.JobID} / ${alloc.TaskGroup}`,
              status: alloc.ClientStatus,
              namespace: alloc.Namespace,
            });
          }
        });
      }
    }
  } catch (error) {
    console.error(`Search failed for cluster ${clusterName}:`, error);
  }

  return results;
}

function ResultItem({
  result,
  onClick,
}: {
  result: SearchResult;
  onClick: () => void;
}) {
  const theme = useTheme();

  const iconMap = {
    job: 'mdi:briefcase-outline',
    node: 'mdi:server',
    allocation: 'mdi:cube-outline',
  };

  const statusColors: Record<string, string> = {
    running: theme.palette.success.main,
    ready: theme.palette.success.main,
    pending: theme.palette.warning.main,
    dead: theme.palette.error.main,
    down: theme.palette.error.main,
    failed: theme.palette.error.main,
  };

  return (
    <ListItemButton onClick={onClick} sx={{ py: 1 }}>
      <ListItemIcon sx={{ minWidth: 36 }}>
        <Icon icon={iconMap[result.type]} width={20} />
      </ListItemIcon>
      <ListItemText
        primary={
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
              {result.name}
            </Typography>
            <Box
              component="span"
              sx={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: statusColors[result.status] || theme.palette.grey[400],
              }}
            />
          </Box>
        }
        secondary={
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography component="span" variant="caption" color="text.secondary">
              {result.type}
            </Typography>
            {result.namespace && (
              <>
                <Typography component="span" variant="caption" color="text.disabled">
                  ·
                </Typography>
                <Typography component="span" variant="caption" color="text.secondary">
                  {result.namespace}
                </Typography>
              </>
            )}
            <Typography component="span" variant="caption" color="text.disabled">
              ·
            </Typography>
            <Typography
              component="span"
              variant="caption"
              sx={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'text.disabled' }}
            >
              {result.id.substring(0, 8)}
            </Typography>
          </Box>
        }
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <ClusterAvatar name={result.cluster} size={18} />
        <Typography variant="caption" color="text.secondary">
          {result.cluster}
        </Typography>
      </Box>
    </ListItemButton>
  );
}

export default function GlobalSearch() {
  const theme = useTheme();
  const navigate = useNavigate();
  const clusters = useTypedSelector(state => state.config.clusters) || {};
  const currentCluster = getCluster();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const clusterList = Object.keys(clusters);
  const hasMultipleClusters = clusterList.length > 1;

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);

      // Search all clusters in parallel
      const searchPromises = clusterList.map(cluster => searchCluster(cluster, query));
      const allResults = await Promise.all(searchPromises);

      // Flatten and sort results (current cluster first)
      const flatResults = allResults.flat().sort((a, b) => {
        // Current cluster results first
        if (a.cluster === currentCluster && b.cluster !== currentCluster) return -1;
        if (b.cluster === currentCluster && a.cluster !== currentCluster) return 1;
        // Then by type (jobs, nodes, allocations)
        const typeOrder = { job: 0, node: 1, allocation: 2 };
        if (typeOrder[a.type] !== typeOrder[b.type]) {
          return typeOrder[a.type] - typeOrder[b.type];
        }
        // Then by name
        return a.name.localeCompare(b.name);
      });

      setResults(flatResults.slice(0, 20)); // Limit to 20 results
      setLoading(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, clusterList.join(','), currentCluster]);

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery('');

      // Navigate to the result
      switch (result.type) {
        case 'job':
          navigate(
            createRouteURL('nomadJob', {
              cluster: result.cluster,
              name: result.id,
              namespace: result.namespace || 'default',
            })
          );
          break;
        case 'node':
          navigate(
            createRouteURL('nomadNode', {
              cluster: result.cluster,
              id: result.id,
            })
          );
          break;
        case 'allocation':
          navigate(
            createRouteURL('nomadAllocation', {
              cluster: result.cluster,
              id: result.id,
            })
          );
          break;
      }
    },
    [navigate]
  );

  const handleClose = () => {
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  return (
    <>
      <Tooltip title={`Search ${hasMultipleClusters ? 'all clusters' : ''} (⌘K)`}>
        <IconButton onClick={() => setOpen(true)} color="inherit" size="small">
          <Icon icon="mdi:magnify" width={20} />
        </IconButton>
      </Tooltip>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            position: 'fixed',
            top: '15%',
            m: 0,
            borderRadius: 2,
          },
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          <TextField
            autoFocus
            fullWidth
            placeholder={
              hasMultipleClusters ? 'Search jobs, nodes across all clusters...' : 'Search jobs, nodes...'
            }
            value={query}
            onChange={e => setQuery(e.target.value)}
            variant="outlined"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {loading ? (
                    <CircularProgress size={20} />
                  ) : (
                    <Icon icon="mdi:magnify" width={20} />
                  )}
                </InputAdornment>
              ),
              endAdornment: query && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setQuery('')}>
                    <Icon icon="mdi:close" width={16} />
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                '& fieldset': { border: 'none' },
                fontSize: '1rem',
              },
            }}
            sx={{ px: 1 }}
          />

          {query.length >= 2 && (
            <>
              <Divider />
              {results.length > 0 ? (
                <List sx={{ py: 1, maxHeight: 400, overflow: 'auto' }}>
                  {results.map((result, index) => (
                    <ResultItem
                      key={`${result.cluster}-${result.type}-${result.id}`}
                      result={result}
                      onClick={() => handleResultClick(result)}
                    />
                  ))}
                </List>
              ) : !loading ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">No results found</Typography>
                </Box>
              ) : null}
            </>
          )}

          {!query && (
            <Box sx={{ p: 2, color: 'text.secondary' }}>
              <Typography variant="caption">
                Search for jobs, nodes, or allocations
                {hasMultipleClusters && ' across all connected clusters'}.
              </Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                <Typography variant="caption">
                  <kbd style={{ padding: '2px 6px', borderRadius: 4, background: theme.palette.action.hover }}>
                    ↵
                  </kbd>{' '}
                  to select
                </Typography>
                <Typography variant="caption">
                  <kbd style={{ padding: '2px 6px', borderRadius: 4, background: theme.palette.action.hover }}>
                    esc
                  </kbd>{' '}
                  to close
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
