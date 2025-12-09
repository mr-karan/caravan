import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  alpha,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  InputAdornment,
  List,
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
  score: number;
}

// Fuzzy match scoring - returns a score (higher is better match), 0 means no match
function fuzzyMatch(text: string, query: string): number {
  if (!text || !query) return 0;
  
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact match - highest score
  if (textLower === queryLower) return 100;

  // Starts with query - very high score
  if (textLower.startsWith(queryLower)) return 90;

  // Contains query as substring - high score
  if (textLower.includes(queryLower)) return 80;

  // Split query into words and check if all words match
  const queryWords = queryLower.split(/[\s\-_]+/).filter(w => w.length > 0);
  const textWords = textLower.split(/[\s\-_]+/).filter(w => w.length > 0);

  if (queryWords.length > 1) {
    const allWordsMatch = queryWords.every(
      qw => textWords.some(tw => tw.includes(qw)) || textLower.includes(qw)
    );
    if (allWordsMatch) return 70;
  }

  // Check if query words match start of text words
  if (queryWords.length === 1 && queryWords[0].length >= 2) {
    const matchesWordStarts = textWords.some(tw => tw.startsWith(queryWords[0]));
    if (matchesWordStarts) return 60;
  }

  // Fuzzy character matching
  let textIndex = 0;
  let matchedChars = 0;
  for (const char of queryLower) {
    const foundIndex = textLower.indexOf(char, textIndex);
    if (foundIndex !== -1) {
      matchedChars++;
      textIndex = foundIndex + 1;
    }
  }

  const matchRatio = matchedChars / queryLower.length;
  if (matchRatio >= 0.8) return Math.round(50 * matchRatio);

  return 0;
}

async function searchCluster(clusterName: string, query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  const fetchOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Search jobs - fetch from all namespaces
  try {
    const jobsRes = await fetch(
      `/api/clusters/${encodeURIComponent(clusterName)}/v1/jobs?namespace=*`,
      fetchOptions
    );
    if (jobsRes.ok) {
      const jobs = await jobsRes.json();
      if (Array.isArray(jobs)) {
        jobs.forEach((job: any) => {
          // Try both Name and ID fields
          const name = job.Name || job.name || '';
          const id = job.ID || job.id || '';
          const nameScore = fuzzyMatch(name, query);
          const idScore = fuzzyMatch(id, query);
          const score = Math.max(nameScore, idScore);

          if (score > 0) {
            results.push({
              cluster: clusterName,
              type: 'job',
              id: id,
              name: name || id,
              status: job.Status || job.status || 'unknown',
              namespace: job.Namespace || job.namespace,
              score,
            });
          }
        });
      }
    }
  } catch (error) {
    console.error(`Jobs search failed for ${clusterName}:`, error);
  }

  // Search nodes
  try {
    const nodesRes = await fetch(
      `/api/clusters/${encodeURIComponent(clusterName)}/v1/nodes`,
      fetchOptions
    );
    if (nodesRes.ok) {
      const nodes = await nodesRes.json();
      if (Array.isArray(nodes)) {
        nodes.forEach((node: any) => {
          const name = node.Name || node.name || '';
          const id = node.ID || node.id || '';
          const nameScore = fuzzyMatch(name, query);
          const idScore = fuzzyMatch(id, query);
          const score = Math.max(nameScore, idScore);

          if (score > 0) {
            results.push({
              cluster: clusterName,
              type: 'node',
              id: id,
              name: name || id,
              status: node.Status || node.status || 'unknown',
              score,
            });
          }
        });
      }
    }
  } catch (error) {
    console.error(`Nodes search failed for ${clusterName}:`, error);
  }

  // Search allocations (by ID prefix or job name) - fetch from all namespaces
  if (query.length >= 3) {
    try {
      const allocsRes = await fetch(
        `/api/clusters/${encodeURIComponent(clusterName)}/v1/allocations?namespace=*`,
        fetchOptions
      );
      if (allocsRes.ok) {
        const allocs = await allocsRes.json();
        if (Array.isArray(allocs)) {
          allocs.slice(0, 200).forEach((alloc: any) => {
            const id = alloc.ID || alloc.id || '';
            const jobId = alloc.JobID || alloc.jobId || '';
            const taskGroup = alloc.TaskGroup || alloc.taskGroup || '';
            
            const idScore = fuzzyMatch(id, query);
            const jobScore = fuzzyMatch(jobId, query);
            const taskGroupScore = fuzzyMatch(taskGroup, query);
            const score = Math.max(idScore, jobScore * 0.9, taskGroupScore * 0.8);

            if (score > 0) {
              results.push({
                cluster: clusterName,
                type: 'allocation',
                id: id,
                name: `${jobId} / ${taskGroup}`,
                status: alloc.ClientStatus || alloc.clientStatus || 'unknown',
                namespace: alloc.Namespace || alloc.namespace,
                score,
              });
            }
          });
        }
      }
    } catch (error) {
      console.error(`Allocations search failed for ${clusterName}:`, error);
    }
  }

  return results;
}

// Result type config for better visual distinction
const typeConfig = {
  job: {
    icon: 'mdi:briefcase',
    label: 'Job',
    color: '#3b82f6', // blue
  },
  node: {
    icon: 'mdi:server',
    label: 'Node',
    color: '#8b5cf6', // purple
  },
  allocation: {
    icon: 'mdi:cube-outline',
    label: 'Alloc',
    color: '#f59e0b', // amber
  },
};

function ResultItem({ result, onClick }: { result: SearchResult; onClick: () => void }) {
  const theme = useTheme();
  const config = typeConfig[result.type];

  const statusColors: Record<string, string> = {
    running: theme.palette.success.main,
    ready: theme.palette.success.main,
    pending: theme.palette.warning.main,
    dead: theme.palette.error.main,
    down: theme.palette.error.main,
    failed: theme.palette.error.main,
    complete: theme.palette.info.main,
  };

  return (
    <ListItemButton
      onClick={onClick}
      sx={{
        py: 1.5,
        px: 2,
        '&:hover': {
          backgroundColor: alpha(config.color, 0.08),
        },
      }}
    >
      {/* Type indicator */}
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          backgroundColor: alpha(config.color, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mr: 1.5,
          flexShrink: 0,
        }}
      >
        <Icon icon={config.icon} width={20} color={config.color} />
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {result.name}
          </Typography>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: statusColors[result.status] || theme.palette.grey[400],
              flexShrink: 0,
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={config.label}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              fontWeight: 600,
              backgroundColor: alpha(config.color, 0.1),
              color: config.color,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
          {result.namespace && (
            <Typography variant="caption" color="text.secondary">
              {result.namespace}
            </Typography>
          )}
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              color: 'text.disabled',
            }}
          >
            {result.id.substring(0, 8)}
          </Typography>
        </Box>
      </Box>

      {/* Cluster badge */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          ml: 1,
          flexShrink: 0,
        }}
      >
        <ClusterAvatar name={result.cluster} size={18} />
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          {result.cluster}
        </Typography>
      </Box>
    </ListItemButton>
  );
}

// Group results by type for better organization
function groupResultsByType(results: SearchResult[]): Record<string, SearchResult[]> {
  const grouped: Record<string, SearchResult[]> = {
    job: [],
    node: [],
    allocation: [],
  };

  results.forEach(result => {
    grouped[result.type].push(result);
  });

  return grouped;
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

      // Flatten and sort results by relevance
      const flatResults = allResults.flat().sort((a, b) => {
        // First by match score (higher is better)
        if (a.score !== b.score) return b.score - a.score;
        // Then current cluster first
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

      setResults(flatResults.slice(0, 30)); // Limit to 30 results
      setLoading(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, clusterList.join(','), currentCluster]);

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery('');

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

  const groupedResults = groupResultsByType(results);
  const hasResults = results.length > 0;

  return (
    <>
      <Tooltip title={`Search ${hasMultipleClusters ? 'all clusters' : ''} (⌘K)`}>
        <IconButton
          onClick={() => setOpen(true)}
          size="small"
          sx={{
            width: 36,
            height: 36,
            color: theme.palette.navbar?.color ?? theme.palette.text.primary,
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
            },
          }}
        >
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
            top: '12%',
            m: 0,
            borderRadius: 2,
            maxHeight: '70vh',
          },
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          <TextField
            autoFocus
            fullWidth
            placeholder={
              hasMultipleClusters
                ? 'Search jobs, nodes across all clusters...'
                : 'Search jobs, nodes...'
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
            sx={{ px: 1, py: 0.5 }}
          />

          {query.length >= 2 && (
            <>
              <Divider />
              {hasResults ? (
                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {/* Jobs section */}
                  {groupedResults.job.length > 0 && (
                    <Box>
                      <Box
                        sx={{
                          px: 2,
                          py: 1,
                          backgroundColor: alpha(typeConfig.job.color, 0.05),
                          borderBottom: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            color: typeConfig.job.color,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          Jobs ({groupedResults.job.length})
                        </Typography>
                      </Box>
                      <List disablePadding>
                        {groupedResults.job.map(result => (
                          <ResultItem
                            key={`${result.cluster}-${result.type}-${result.id}`}
                            result={result}
                            onClick={() => handleResultClick(result)}
                          />
                        ))}
                      </List>
                    </Box>
                  )}

                  {/* Nodes section */}
                  {groupedResults.node.length > 0 && (
                    <Box>
                      <Box
                        sx={{
                          px: 2,
                          py: 1,
                          backgroundColor: alpha(typeConfig.node.color, 0.05),
                          borderBottom: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            color: typeConfig.node.color,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          Nodes ({groupedResults.node.length})
                        </Typography>
                      </Box>
                      <List disablePadding>
                        {groupedResults.node.map(result => (
                          <ResultItem
                            key={`${result.cluster}-${result.type}-${result.id}`}
                            result={result}
                            onClick={() => handleResultClick(result)}
                          />
                        ))}
                      </List>
                    </Box>
                  )}

                  {/* Allocations section */}
                  {groupedResults.allocation.length > 0 && (
                    <Box>
                      <Box
                        sx={{
                          px: 2,
                          py: 1,
                          backgroundColor: alpha(typeConfig.allocation.color, 0.05),
                          borderBottom: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            color: typeConfig.allocation.color,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          Allocations ({groupedResults.allocation.length})
                        </Typography>
                      </Box>
                      <List disablePadding>
                        {groupedResults.allocation.map(result => (
                          <ResultItem
                            key={`${result.cluster}-${result.type}-${result.id}`}
                            result={result}
                            onClick={() => handleResultClick(result)}
                          />
                        ))}
                      </List>
                    </Box>
                  )}
                </Box>
              ) : !loading ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Icon icon="mdi:magnify" width={40} color={theme.palette.text.disabled} />
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    No results found for "{query}"
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    Try a different search term
                  </Typography>
                </Box>
              ) : null}
            </>
          )}

          {!query && (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Search for jobs, nodes, or allocations
                {hasMultipleClusters && ' across all connected clusters'}.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {Object.entries(typeConfig).map(([type, config]) => (
                  <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: 0.5,
                        backgroundColor: alpha(config.color, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon icon={config.icon} width={12} color={config.color} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {config.label}s
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Typography variant="caption" color="text.disabled">
                  <kbd
                    style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: theme.palette.action.hover,
                    }}
                  >
                    ↵
                  </kbd>{' '}
                  select
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  <kbd
                    style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: theme.palette.action.hover,
                    }}
                  >
                    esc
                  </kbd>{' '}
                  close
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
