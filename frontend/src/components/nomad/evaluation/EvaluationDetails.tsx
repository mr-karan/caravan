import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Chip,
  Grid,
  IconButton,
  Link,
  Paper,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { SectionBox, Loader, ErrorPage, SimpleTable } from '../../common';
import { getEvaluation, getEvaluationAllocations } from '../../../lib/nomad/api';
import { Evaluation, AllocationListStub } from '../../../lib/nomad/types';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import BackLink from '../../common/BackLink';
import { CopyableText, CopyableId } from '../CopyButton';
import { MinimalStatus, InlineBadge } from '../statusStyles';

// Status color mapping
function getStatusColor(status: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  switch (status) {
    case 'complete':
      return 'success';
    case 'pending':
    case 'blocked':
      return 'warning';
    case 'failed':
    case 'canceled':
      return 'error';
    default:
      return 'default';
  }
}

// Info row component
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ flex: 1 }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function EvaluationDetails() {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [allocations, setAllocations] = useState<AllocationListStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [evalData, allocData] = await Promise.all([
        getEvaluation(id),
        getEvaluationAllocations(id),
      ]);
      setEvaluation(evalData);
      setAllocations(allocData || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <Loader title="Loading evaluation..." />;
  }

  if (error) {
    return <ErrorPage message="Error loading evaluation" error={error} />;
  }

  if (!evaluation) {
    return <ErrorPage message="Evaluation not found" />;
  }

  return (
    <Box>
      <BackLink />

      <SectionBox
        title={
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h5" component="span">
              Evaluation
            </Typography>
            <CopyableId id={evaluation.ID} />
            <Chip
              label={evaluation.Status}
              size="small"
              color={getStatusColor(evaluation.Status)}
            />
          </Box>
        }
        headerProps={{
          actions: [
            <Tooltip key="refresh" title="Refresh">
              <IconButton onClick={loadData} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>,
          ],
        }}
      >
        <Grid container spacing={3}>
          {/* Left column - Basic Info */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                BASIC INFORMATION
              </Typography>

              <InfoRow label="ID" value={<CopyableText value={evaluation.ID} fontFamily="monospace" />} />
              <InfoRow
                label="Status"
                value={
                  <Box display="flex" alignItems="center" gap={1}>
                    <MinimalStatus status={evaluation.Status} />
                    {evaluation.StatusDescription && (
                      <Typography variant="caption" color="text.secondary">
                        ({evaluation.StatusDescription})
                      </Typography>
                    )}
                  </Box>
                }
              />
              <InfoRow label="Type" value={<InlineBadge>{evaluation.Type}</InlineBadge>} />
              <InfoRow label="Priority" value={evaluation.Priority} />
              <InfoRow label="Triggered By" value={<InlineBadge>{evaluation.TriggeredBy}</InlineBadge>} />
              <InfoRow
                label="Namespace"
                value={<Chip label={evaluation.Namespace} size="small" variant="outlined" />}
              />
            </Paper>
          </Grid>

          {/* Right column - Job & Timing */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                JOB & TIMING
              </Typography>

              <InfoRow
                label="Job"
                value={
                  <Link
                    component={RouterLink}
                    to={createRouteURL('nomadJob', {
                      name: evaluation.JobID,
                      namespace: evaluation.Namespace,
                    })}
                  >
                    {evaluation.JobID}
                  </Link>
                }
              />
              <InfoRow label="Job Modify Index" value={evaluation.JobModifyIndex} />
              {evaluation.NodeID && (
                <InfoRow
                  label="Node"
                  value={
                    <Link
                      component={RouterLink}
                      to={createRouteURL('nomadNode', { id: evaluation.NodeID })}
                    >
                      <CopyableId id={evaluation.NodeID} />
                    </Link>
                  }
                />
              )}
              {evaluation.DeploymentID && (
                <InfoRow
                  label="Deployment"
                  value={<CopyableId id={evaluation.DeploymentID} />}
                />
              )}
              <InfoRow
                label="Created"
                value={evaluation.CreateTime ? <DateLabel date={new Date(evaluation.CreateTime / 1000000)} /> : '-'}
              />
              <InfoRow
                label="Modified"
                value={evaluation.ModifyTime ? <DateLabel date={new Date(evaluation.ModifyTime / 1000000)} /> : '-'}
              />
            </Paper>
          </Grid>

          {/* Related Evaluations */}
          {(evaluation.NextEval || evaluation.PreviousEval || evaluation.BlockedEval) && (
            <Grid size={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                  RELATED EVALUATIONS
                </Typography>

                {evaluation.PreviousEval && (
                  <InfoRow
                    label="Previous"
                    value={
                      <Link
                        component={RouterLink}
                        to={createRouteURL('nomadEvaluation', { id: evaluation.PreviousEval })}
                      >
                        <CopyableId id={evaluation.PreviousEval} />
                      </Link>
                    }
                  />
                )}
                {evaluation.NextEval && (
                  <InfoRow
                    label="Next"
                    value={
                      <Link
                        component={RouterLink}
                        to={createRouteURL('nomadEvaluation', { id: evaluation.NextEval })}
                      >
                        <CopyableId id={evaluation.NextEval} />
                      </Link>
                    }
                  />
                )}
                {evaluation.BlockedEval && (
                  <InfoRow
                    label="Blocked"
                    value={
                      <Link
                        component={RouterLink}
                        to={createRouteURL('nomadEvaluation', { id: evaluation.BlockedEval })}
                      >
                        <CopyableId id={evaluation.BlockedEval} />
                      </Link>
                    }
                  />
                )}
              </Paper>
            </Grid>
          )}

          {/* Queued Allocations */}
          {evaluation.QueuedAllocations && Object.keys(evaluation.QueuedAllocations).length > 0 && (
            <Grid size={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                  QUEUED ALLOCATIONS
                </Typography>
                <Box display="flex" gap={2} flexWrap="wrap">
                  {Object.entries(evaluation.QueuedAllocations).map(([taskGroup, count]) => (
                    <Chip
                      key={taskGroup}
                      label={`${taskGroup}: ${count}`}
                      size="small"
                      variant="outlined"
                      color={count > 0 ? 'warning' : 'default'}
                    />
                  ))}
                </Box>
              </Paper>
            </Grid>
          )}

          {/* Failed Task Group Allocations */}
          {evaluation.FailedTGAllocs && Object.keys(evaluation.FailedTGAllocs).length > 0 && (
            <Grid size={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, color: 'error.main' }}>
                  FAILED TASK GROUP ALLOCATIONS
                </Typography>
                {Object.entries(evaluation.FailedTGAllocs).map(([taskGroup, metrics]) => (
                  <Box key={taskGroup} sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                      {taskGroup}
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      <Chip label={`Nodes Evaluated: ${metrics.NodesEvaluated}`} size="small" variant="outlined" />
                      <Chip label={`Nodes Filtered: ${metrics.NodesFiltered}`} size="small" variant="outlined" />
                      <Chip label={`Nodes Exhausted: ${metrics.NodesExhausted}`} size="small" variant="outlined" />
                      {metrics.CoalescedFailures > 0 && (
                        <Chip
                          label={`Coalesced Failures: ${metrics.CoalescedFailures}`}
                          size="small"
                          color="error"
                        />
                      )}
                    </Box>
                    {metrics.DimensionExhausted && Object.keys(metrics.DimensionExhausted).length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Exhausted Dimensions:
                        </Typography>
                        <Box display="flex" gap={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                          {Object.entries(metrics.DimensionExhausted).map(([dim, count]) => (
                            <Chip key={dim} label={`${dim}: ${count}`} size="small" color="warning" />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                ))}
              </Paper>
            </Grid>
          )}
        </Grid>
      </SectionBox>

      {/* Allocations */}
      <SectionBox title={`Allocations (${allocations.length})`} sx={{ mt: 3 }}>
        {allocations.length === 0 ? (
          <Typography color="text.secondary">No allocations for this evaluation</Typography>
        ) : (
          <SimpleTable
            columns={[
              {
                label: 'ID',
                getter: (alloc: AllocationListStub) => (
                  <Link
                    component={RouterLink}
                    to={createRouteURL('nomadAllocation', { id: alloc.ID })}
                  >
                    <CopyableId id={alloc.ID} />
                  </Link>
                ),
              },
              {
                label: 'Name',
                getter: (alloc: AllocationListStub) => alloc.Name,
              },
              {
                label: 'Task Group',
                getter: (alloc: AllocationListStub) => <InlineBadge>{alloc.TaskGroup}</InlineBadge>,
              },
              {
                label: 'Status',
                getter: (alloc: AllocationListStub) => (
                  <MinimalStatus status={alloc.ClientStatus} />
                ),
              },
              {
                label: 'Node',
                getter: (alloc: AllocationListStub) => (
                  <Link
                    component={RouterLink}
                    to={createRouteURL('nomadNode', { id: alloc.NodeID })}
                  >
                    {alloc.NodeName || alloc.NodeID.substring(0, 8)}
                  </Link>
                ),
              },
              {
                label: 'Created',
                getter: (alloc: AllocationListStub) =>
                  alloc.CreateTime ? <DateLabel date={new Date(alloc.CreateTime / 1000000)} /> : '-',
              },
            ]}
            data={allocations}
            emptyMessage="No allocations"
          />
        )}
      </SectionBox>
    </Box>
  );
}
