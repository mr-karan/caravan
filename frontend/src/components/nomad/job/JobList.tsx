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
  Chip,
  Paper,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import { Icon } from '@iconify/react';
import { SectionBox, SimpleTable, Loader, ErrorPage } from '../../common';
import { listJobs } from '../../../lib/nomad/api';
import { JobListStub } from '../../../lib/nomad/types';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { useNamespace, ALL_NAMESPACES } from '../../../lib/nomad/namespaceContext';
import NamespaceSwitcher from '../NamespaceSwitcher';
import { MinimalStatus, AllocationCounts, InlineBadge } from '../statusStyles';

interface JobNode {
  job: JobListStub;
  children: JobNode[];
  depth: number;
}

// Parse job ID to extract parent path
function getParentJobId(jobId: string): string | null {
  const lastSlash = jobId.lastIndexOf('/');
  if (lastSlash === -1) return null;
  return jobId.substring(0, lastSlash);
}

// Build a tree structure from flat job list
function buildJobTree(jobs: JobListStub[]): JobNode[] {
  const jobMap = new Map<string, JobListStub>();
  const nodeMap = new Map<string, JobNode>();

  // First pass: create a map of all jobs
  jobs.forEach(job => {
    jobMap.set(job.ID, job);
  });

  // Second pass: create nodes and establish relationships
  jobs.forEach(job => {
    const node: JobNode = {
      job,
      children: [],
      depth: 0,
    };
    nodeMap.set(job.ID, node);
  });

  // Third pass: build the tree
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

  // Sort children by submit time (newest first)
  const sortNodes = (nodes: JobNode[]) => {
    nodes.sort((a, b) => (b.job.SubmitTime || 0) - (a.job.SubmitTime || 0));
    nodes.forEach(node => sortNodes(node.children));
  };
  sortNodes(rootNodes);

  return rootNodes;
}

// Flatten tree for display with expand/collapse state
function flattenTree(
  nodes: JobNode[],
  expandedIds: Set<string>,
  result: JobNode[] = []
): JobNode[] {
  nodes.forEach(node => {
    result.push(node);
    if (node.children.length > 0 && expandedIds.has(node.job.ID)) {
      flattenTree(node.children, expandedIds, result);
    }
  });
  return result;
}

// Get summary stats - minimal inline display with colored numbers
function JobSummaryStats({ job }: { job: JobListStub }) {
  if (!job.JobSummary?.Summary) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
        —
      </Typography>
    );
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
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
        —
      </Typography>
    );
  }

  return (
    <AllocationCounts
      running={summary.running}
      pending={summary.pending}
      failed={summary.failed}
      complete={summary.complete}
    />
  );
}

export default function JobList() {
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

  // Build tree structure
  const jobTree = useMemo(() => buildJobTree(jobs), [jobs]);

  // Filter jobs based on search
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

  // Get flattened tree for display
  const displayJobs = useMemo(() => {
    if (viewMode === 'flat' || searchQuery.trim()) {
      // In flat mode or when searching, show all jobs sorted by submit time
      return [...filteredJobs].sort((a, b) => (b.SubmitTime || 0) - (a.SubmitTime || 0));
    }
    return flattenTree(jobTree, expandedIds);
  }, [viewMode, jobTree, expandedIds, filteredJobs, searchQuery]);

  const toggleExpand = (jobId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
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

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const theme = useTheme();

  // Count jobs with children
  const jobsWithChildren = useMemo(() => {
    return jobs.filter(job => {
      const childJobs = jobs.filter(
        j => j.ParentID === job.ID || getParentJobId(j.ID) === job.ID
      );
      return childJobs.length > 0;
    }).length;
  }, [jobs]);

  // Calculate status breakdown
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
    return <Loader title="Loading jobs..." />;
  }

  if (error) {
    return <ErrorPage message="Error loading jobs" error={error} />;
  }

  return (
    <Box>
      {/* Header Section */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          background: alpha(theme.palette.primary.main, 0.03),
          border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        }}
      >
        {/* Top Row: Title and Stats */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <Icon icon="mdi:briefcase-outline" width={28} color={theme.palette.primary.main} />
              <Typography variant="h5" fontWeight={600}>
                Jobs
              </Typography>
            </Box>
            <Chip
              label={jobs.length}
              size="small"
              sx={{
                fontWeight: 600,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
              }}
            />
          </Box>

          {/* Quick Stats */}
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title="Running jobs">
              <Chip
                icon={<Icon icon="mdi:play-circle" width={14} />}
                label={statusBreakdown.running}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  color: theme.palette.success.main,
                  '& .MuiChip-icon': { color: 'inherit' },
                }}
              />
            </Tooltip>
            <Tooltip title="Pending jobs">
              <Chip
                icon={<Icon icon="mdi:clock-outline" width={14} />}
                label={statusBreakdown.pending}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  color: theme.palette.warning.main,
                  '& .MuiChip-icon': { color: 'inherit' },
                }}
              />
            </Tooltip>
            <Tooltip title="Dead jobs">
              <Chip
                icon={<Icon icon="mdi:stop-circle" width={14} />}
                label={statusBreakdown.dead}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.text.disabled, 0.1),
                  color: theme.palette.text.secondary,
                  '& .MuiChip-icon': { color: 'inherit' },
                }}
              />
            </Tooltip>
            {jobsWithChildren > 0 && (
              <Tooltip title={`${jobsWithChildren} jobs have child jobs (periodic/parameterized)`}>
                <Chip
                  icon={<Icon icon="mdi:file-tree" width={14} />}
                  label={`${jobsWithChildren} parents`}
                  size="small"
                  variant="outlined"
                  sx={{ color: theme.palette.text.secondary }}
                />
              </Tooltip>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Controls Row */}
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
          {/* Left: Search */}
          <TextField
            size="small"
            placeholder="Search by name, type, namespace..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Icon icon="mdi:magnify" width={20} color={theme.palette.text.secondary} />
                </InputAdornment>
              ),
              sx: {
                borderRadius: 2,
                bgcolor: theme.palette.background.paper,
              },
            }}
            sx={{ minWidth: 280, flexGrow: 1, maxWidth: 400 }}
          />

          {/* Right: View Controls */}
          <Box display="flex" alignItems="center" gap={1}>
            {/* View Mode Toggle */}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, value) => value && setViewMode(value)}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  px: 1.5,
                  borderRadius: 1,
                  border: `1px solid ${theme.palette.divider}`,
                  '&.Mui-selected': {
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    borderColor: theme.palette.primary.main,
                  },
                },
              }}
            >
              <ToggleButton value="tree">
                <Tooltip title="Tree view (grouped by parent)">
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <Icon icon="mdi:file-tree-outline" width={18} />
                    <Typography variant="caption" sx={{ display: { xs: 'none', sm: 'block' } }}>
                      Tree
                    </Typography>
                  </Box>
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="flat">
                <Tooltip title="Flat view (all jobs)">
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <Icon icon="mdi:format-list-bulleted" width={18} />
                    <Typography variant="caption" sx={{ display: { xs: 'none', sm: 'block' } }}>
                      List
                    </Typography>
                  </Box>
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Expand/Collapse (only in tree mode with children) */}
            {viewMode === 'tree' && jobsWithChildren > 0 && (
              <Box
                display="flex"
                sx={{
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <Tooltip title="Expand all">
                  <IconButton
                    onClick={expandAll}
                    size="small"
                    sx={{ borderRadius: 0, px: 1 }}
                  >
                    <Icon icon="mdi:unfold-more-horizontal" width={18} />
                  </IconButton>
                </Tooltip>
                <Divider orientation="vertical" flexItem />
                <Tooltip title="Collapse all">
                  <IconButton
                    onClick={collapseAll}
                    size="small"
                    sx={{ borderRadius: 0, px: 1 }}
                  >
                    <Icon icon="mdi:unfold-less-horizontal" width={18} />
                  </IconButton>
                </Tooltip>
              </Box>
            )}

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 28, alignSelf: 'center' }} />

            {/* Namespace Switcher */}
            <NamespaceSwitcher />

            {/* Refresh */}
            <Tooltip title="Refresh">
              <IconButton
                onClick={loadJobs}
                size="small"
                sx={{
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1,
                }}
              >
                <Icon icon="mdi:refresh" width={18} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Table Section */}
      <SectionBox
        title=""
        headerProps={{ actions: [] }}
      >
      <SimpleTable
        columns={[
          {
            label: 'Name',
            getter: (item: JobNode | JobListStub) => {
              const job = 'job' in item ? item.job : item;
              const depth = 'depth' in item ? item.depth : 0;
              const hasChildren = 'children' in item ? item.children.length > 0 : false;
              const isExpanded = expandedIds.has(job.ID);

              // Check if any job in the tree has children (to decide if we need expand column)
              const hasAnyChildren = jobsWithChildren > 0;

              return (
                <Box
                  display="flex"
                  alignItems="center"
                  sx={{ pl: viewMode === 'tree' ? depth * 2 : 0 }}
                >
                  {/* Expand/collapse button or spacer for alignment */}
                  {viewMode === 'tree' && hasAnyChildren && (
                    hasChildren ? (
                      <IconButton
                        size="small"
                        onClick={e => {
                          e.stopPropagation();
                          toggleExpand(job.ID);
                        }}
                        sx={{ mr: 0.5, p: 0.25, opacity: 0.5 }}
                      >
                        <Icon
                          icon={isExpanded ? 'mdi:chevron-down' : 'mdi:chevron-right'}
                          width={16}
                        />
                      </IconButton>
                    ) : (
                      <Box sx={{ width: 24, mr: 0.5 }} />
                    )
                  )}
                  <Box sx={{ minWidth: 0 }}>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Link
                        component={RouterLink}
                        to={createRouteURL('nomadJob', {
                          name: job.ID,
                          namespace: job.Namespace,
                        })}
                        sx={{ fontWeight: depth === 0 ? 500 : 400 }}
                      >
                        {depth > 0 ? job.ID.split('/').pop() : job.Name}
                      </Link>
                      {/* Subtle inline indicators */}
                      {job.Periodic && (
                        <Tooltip title="Periodic job">
                          <Box component="span" sx={{ display: 'inline-flex', opacity: 0.6 }}>
                            <Icon icon="mdi:clock-outline" width={12} color="inherit" />
                          </Box>
                        </Tooltip>
                      )}
                      {job.ParameterizedJob && (
                        <Tooltip title="Parameterized job">
                          <Box component="span" sx={{ display: 'inline-flex', opacity: 0.6 }}>
                            <Icon icon="mdi:send-outline" width={12} color="inherit" />
                          </Box>
                        </Tooltip>
                      )}
                    </Box>
                    {depth > 0 && (
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ display: 'block', fontSize: '0.6875rem' }}
                      >
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
              return <InlineBadge>{job.Type}</InlineBadge>;
            },
            gridTemplate: 'auto',
          },
          {
            label: 'Namespace',
            getter: (item: JobNode | JobListStub) => {
              const job = 'job' in item ? item.job : item;
              return <InlineBadge>{job.Namespace}</InlineBadge>;
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
              return job.SubmitTime ? (
                <DateLabel date={new Date(job.SubmitTime / 1000000)} />
              ) : (
                '—'
              );
            },
            gridTemplate: 'auto',
          },
        ]}
        data={displayJobs}
        emptyMessage="No jobs found"
      />
      </SectionBox>
    </Box>
  );
}
