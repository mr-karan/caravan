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
  ToggleButton,
  ToggleButtonGroup,
  alpha,
  useTheme,
  Paper,
  Skeleton,
} from '@mui/material';
import { Icon } from '@iconify/react';
import { SimpleTable, ErrorPage } from '../../common';
import { listJobs } from '../../../lib/nomad/api';
import { JobListStub } from '../../../lib/nomad/types';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { useNamespace, ALL_NAMESPACES } from '../../../lib/nomad/namespaceContext';
import NamespaceSwitcher from '../NamespaceSwitcher';
import { MinimalStatus, AllocationCounts, minimalStatusColors } from '../statusStyles';

interface JobNode {
  job: JobListStub;
  children: JobNode[];
  depth: number;
}

function getParentJobId(jobId: string): string | null {
  const lastSlash = jobId.lastIndexOf('/');
  if (lastSlash === -1) return null;
  return jobId.substring(0, lastSlash);
}

function buildJobTree(jobs: JobListStub[]): JobNode[] {
  const jobMap = new Map<string, JobListStub>();
  const nodeMap = new Map<string, JobNode>();

  jobs.forEach(job => {
    jobMap.set(job.ID, job);
  });

  jobs.forEach(job => {
    const node: JobNode = { job, children: [], depth: 0 };
    nodeMap.set(job.ID, node);
  });

  const rootNodes: JobNode[] = [];

  jobs.forEach(job => {
    const node = nodeMap.get(job.ID)!;
    const parentId = job.ParentID || getParentJobId(job.ID);

    if (parentId && nodeMap.has(parentId)) {
      const parentNode = nodeMap.get(parentId)!;
      node.depth = parentNode.depth + 1;
      parentNode.children.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  const sortNodes = (nodes: JobNode[]) => {
    nodes.sort((a, b) => (b.job.SubmitTime || 0) - (a.job.SubmitTime || 0));
    nodes.forEach(node => sortNodes(node.children));
  };
  sortNodes(rootNodes);

  return rootNodes;
}

function flattenTree(nodes: JobNode[], expandedIds: Set<string>, result: JobNode[] = []): JobNode[] {
  nodes.forEach(node => {
    result.push(node);
    if (node.children.length > 0 && expandedIds.has(node.job.ID)) {
      flattenTree(node.children, expandedIds, result);
    }
  });
  return result;
}

function JobSummaryStats({ job }: { job: JobListStub }) {
  if (!job.JobSummary?.Summary) {
    return <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>—</Typography>;
  }

  const summary = Object.values(job.JobSummary.Summary).reduce(
    (acc, tg) => ({
      running: acc.running + tg.Running,
      pending: acc.pending + tg.Queued + tg.Starting,
      failed: acc.failed + tg.Failed + tg.Lost,
      complete: acc.complete + tg.Complete,
    }),
    { running: 0, pending: 0, failed: 0, complete: 0 }
  );

  const total = summary.running + summary.pending + summary.failed + summary.complete;
  if (total === 0) {
    return <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.75rem' }}>—</Typography>;
  }

  return <AllocationCounts running={summary.running} pending={summary.pending} failed={summary.failed} complete={summary.complete} />;
}

export default function JobList() {
  const theme = useTheme();
  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;
  const { namespace } = useNamespace();
  const [jobs, setJobs] = useState<JobListStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree');
  const [searchQuery, setSearchQuery] = useState('');

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      const params = namespace === ALL_NAMESPACES ? { namespace: '*' } : { namespace };
      const data = await listJobs(params);
      setJobs(data || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [namespace]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const jobTree = useMemo(() => buildJobTree(jobs), [jobs]);

  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;
    const query = searchQuery.toLowerCase();
    return jobs.filter(
      job =>
        job.ID.toLowerCase().includes(query) ||
        job.Name.toLowerCase().includes(query) ||
        job.Namespace.toLowerCase().includes(query) ||
        job.Type.toLowerCase().includes(query) ||
        job.Status.toLowerCase().includes(query)
    );
  }, [jobs, searchQuery]);

  const displayJobs = useMemo(() => {
    if (viewMode === 'flat' || searchQuery.trim()) {
      return [...filteredJobs].sort((a, b) => (b.SubmitTime || 0) - (a.SubmitTime || 0));
    }
    return flattenTree(jobTree, expandedIds);
  }, [viewMode, jobTree, expandedIds, filteredJobs, searchQuery]);

  const toggleExpand = (jobId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const addIds = (nodes: JobNode[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0) {
          allIds.add(node.job.ID);
          addIds(node.children);
        }
      });
    };
    addIds(jobTree);
    setExpandedIds(allIds);
  };

  const collapseAll = () => setExpandedIds(new Set());

  const jobsWithChildren = useMemo(() => {
    return jobs.filter(job => {
      const childJobs = jobs.filter(j => j.ParentID === job.ID || getParentJobId(j.ID) === job.ID);
      return childJobs.length > 0;
    }).length;
  }, [jobs]);

  const statusBreakdown = useMemo(() => {
    const breakdown = { running: 0, pending: 0, dead: 0 };
    jobs.forEach(job => {
      if (job.Status === 'running') breakdown.running++;
      else if (job.Status === 'pending') breakdown.pending++;
      else breakdown.dead++;
    });
    return breakdown;
  }, [jobs]);

  if (loading) {
    return (
      <Box sx={{ pb: 3 }}>
        <Skeleton variant="rectangular" height={50} sx={{ borderRadius: 1, mb: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  if (error) {
    return <ErrorPage message="Error loading jobs" error={error} />;
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
            Jobs
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.8rem' }}>
            {jobs.length}
          </Typography>
        </Box>

        {/* Inline Stats */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
              <Typography variant="caption" sx={{ color: colors.success, fontWeight: 600, fontSize: '0.8rem' }}>
                {statusBreakdown.running}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>running</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
              <Typography variant="caption" sx={{ color: colors.pending, fontWeight: 600, fontSize: '0.8rem' }}>
                {statusBreakdown.pending}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>pending</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.8rem' }}>
                {statusBreakdown.dead}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>dead</Typography>
            </Box>
            {jobsWithChildren > 0 && (
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', ml: 1 }}>
                {jobsWithChildren} parent{jobsWithChildren !== 1 ? 's' : ''}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/* Controls */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
        }}
      >
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search jobs..."
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

        {/* Right controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* View toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, value) => value && setViewMode(value)}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                px: 1,
                py: 0.5,
                fontSize: '0.7rem',
                border: `1px solid ${theme.palette.divider}`,
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                },
              },
            }}
          >
            <ToggleButton value="tree">
              <Icon icon="mdi:file-tree-outline" width={16} />
            </ToggleButton>
            <ToggleButton value="flat">
              <Icon icon="mdi:format-list-bulleted" width={16} />
            </ToggleButton>
          </ToggleButtonGroup>

          {viewMode === 'tree' && jobsWithChildren > 0 && (
            <>
              <Tooltip title="Expand all">
                <IconButton onClick={expandAll} size="small" sx={{ p: 0.5 }}>
                  <Icon icon="mdi:unfold-more-horizontal" width={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Collapse all">
                <IconButton onClick={collapseAll} size="small" sx={{ p: 0.5 }}>
                  <Icon icon="mdi:unfold-less-horizontal" width={16} />
                </IconButton>
              </Tooltip>
            </>
          )}

          <Box sx={{ width: 1, height: 20, borderLeft: `1px solid ${theme.palette.divider}`, mx: 0.5 }} />

          <NamespaceSwitcher />

          <Tooltip title="Refresh">
            <IconButton onClick={loadJobs} size="small" sx={{ p: 0.75 }}>
              <Icon icon="mdi:refresh" width={18} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Table */}
      <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
        <SimpleTable
          columns={[
            {
              label: 'Name',
              getter: (item: JobNode | JobListStub) => {
                const job = 'job' in item ? item.job : item;
                const depth = 'depth' in item ? item.depth : 0;
                const hasChildren = 'children' in item ? item.children.length > 0 : false;
                const isExpanded = expandedIds.has(job.ID);
                const hasAnyChildren = jobsWithChildren > 0;

                return (
                  <Box display="flex" alignItems="center" sx={{ pl: viewMode === 'tree' ? depth * 2 : 0 }}>
                    {viewMode === 'tree' && hasAnyChildren && (
                      hasChildren ? (
                        <IconButton
                          size="small"
                          onClick={e => { e.stopPropagation(); toggleExpand(job.ID); }}
                          sx={{ mr: 0.5, p: 0.25 }}
                        >
                          <Icon icon={isExpanded ? 'mdi:chevron-down' : 'mdi:chevron-right'} width={14} color={theme.palette.text.secondary} />
                        </IconButton>
                      ) : (
                        <Box sx={{ width: 22, mr: 0.5 }} />
                      )
                    )}
                    <Box sx={{ minWidth: 0 }}>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Link
                          component={RouterLink}
                          to={createRouteURL('nomadJob', { name: job.ID, namespace: job.Namespace })}
                          sx={{ fontWeight: depth === 0 ? 500 : 400, fontSize: '0.85rem' }}
                        >
                          {depth > 0 ? job.ID.split('/').pop() : job.Name}
                        </Link>
                        {job.Periodic && (
                          <Tooltip title="Periodic">
                            <Box component="span" sx={{ display: 'inline-flex', opacity: 0.5 }}>
                              <Icon icon="mdi:clock-outline" width={12} />
                            </Box>
                          </Tooltip>
                        )}
                        {job.ParameterizedJob && (
                          <Tooltip title="Parameterized">
                            <Box component="span" sx={{ display: 'inline-flex', opacity: 0.5 }}>
                              <Icon icon="mdi:send-outline" width={12} />
                            </Box>
                          </Tooltip>
                        )}
                      </Box>
                      {depth > 0 && (
                        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', fontSize: '0.65rem' }}>
                          {job.ID}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              },
            },
            {
              label: 'Status',
              getter: (item: JobNode | JobListStub) => {
                const job = 'job' in item ? item.job : item;
                return <MinimalStatus status={job.Status} />;
              },
              gridTemplate: 'auto',
            },
            {
              label: 'Type',
              getter: (item: JobNode | JobListStub) => {
                const job = 'job' in item ? item.job : item;
                return (
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
                    {job.Type}
                  </Typography>
                );
              },
              gridTemplate: 'auto',
            },
            {
              label: 'Namespace',
              getter: (item: JobNode | JobListStub) => {
                const job = 'job' in item ? item.job : item;
                return (
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                    {job.Namespace}
                  </Typography>
                );
              },
              gridTemplate: 'auto',
            },
            {
              label: 'Allocations',
              getter: (item: JobNode | JobListStub) => {
                const job = 'job' in item ? item.job : item;
                return <JobSummaryStats job={job} />;
              },
            },
            {
              label: 'Age',
              getter: (item: JobNode | JobListStub) => {
                const job = 'job' in item ? item.job : item;
                return job.SubmitTime ? <DateLabel date={new Date(job.SubmitTime / 1000000)} format="mini" /> : '—';
              },
              gridTemplate: 'auto',
            },
          ]}
          data={displayJobs}
          emptyMessage="No jobs found"
        />
      </Paper>
    </Box>
  );
}
