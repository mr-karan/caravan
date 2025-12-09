import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Link,
  Chip,
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
import { listEvaluations } from '../../../lib/nomad/api';
import { Evaluation } from '../../../lib/nomad/types';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { useNamespace, ALL_NAMESPACES } from '../../../lib/nomad/namespaceContext';
import NamespaceSwitcher from '../NamespaceSwitcher';
import { StatusChip, statusColors } from '../statusStyles';
import { CopyableId } from '../CopyButton';

// Summary stats for evaluations
interface EvaluationStats {
  total: number;
  pending: number;
  complete: number;
  failed: number;
  blocked: number;
}

function EvaluationStatsSummary({ stats }: { stats: EvaluationStats }) {
  return (
    <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
      <Chip label={stats.total} size="small" variant="outlined" />
      {stats.pending > 0 && (
        <Tooltip title="Pending evaluations">
          <Chip
            label={`${stats.pending} pending`}
            size="small"
            sx={{
              backgroundColor: statusColors.warning.background,
              color: statusColors.warning.color,
              border: `1px solid ${statusColors.warning.border}`,
            }}
          />
        </Tooltip>
      )}
      {stats.blocked > 0 && (
        <Tooltip title="Blocked evaluations">
          <Chip
            label={`${stats.blocked} blocked`}
            size="small"
            sx={{
              backgroundColor: statusColors.pending.background,
              color: statusColors.pending.color,
              border: `1px solid ${statusColors.pending.border}`,
            }}
          />
        </Tooltip>
      )}
      {stats.complete > 0 && (
        <Tooltip title="Complete evaluations">
          <Chip
            label={`${stats.complete} complete`}
            size="small"
            sx={{
              backgroundColor: statusColors.success.background,
              color: statusColors.success.color,
              border: `1px solid ${statusColors.success.border}`,
            }}
          />
        </Tooltip>
      )}
      {stats.failed > 0 && (
        <Tooltip title="Failed evaluations">
          <Chip
            label={`${stats.failed} failed`}
            size="small"
            sx={{
              backgroundColor: statusColors.error.background,
              color: statusColors.error.color,
              border: `1px solid ${statusColors.error.border}`,
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
}

export default function EvaluationList() {
  const { namespace } = useNamespace();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadEvaluations = useCallback(async () => {
    try {
      setLoading(true);
      const params = namespace === ALL_NAMESPACES ? { namespace: '*' } : { namespace };
      const data = await listEvaluations(params);
      // Sort by creation time (most recent first)
      const sorted = (data || []).sort((a, b) => {
        const aTime = a.CreateTime || 0;
        const bTime = b.CreateTime || 0;
        return bTime - aTime;
      });
      setEvaluations(sorted);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [namespace]);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

  // Calculate stats
  const stats = useMemo<EvaluationStats>(() => {
    return evaluations.reduce(
      (acc, evaluation) => {
        acc.total++;
        const status = evaluation.Status.toLowerCase();
        if (status === 'pending') acc.pending++;
        else if (status === 'complete') acc.complete++;
        else if (status === 'failed' || status === 'canceled') acc.failed++;
        else if (status === 'blocked') acc.blocked++;
        return acc;
      },
      { total: 0, pending: 0, complete: 0, failed: 0, blocked: 0 }
    );
  }, [evaluations]);

  // Filter evaluations based on search
  const filteredEvaluations = useMemo(() => {
    if (!searchQuery.trim()) return evaluations;
    const query = searchQuery.toLowerCase();
    return evaluations.filter(
      evaluation =>
        evaluation.ID.toLowerCase().includes(query) ||
        evaluation.JobID.toLowerCase().includes(query) ||
        evaluation.Status.toLowerCase().includes(query) ||
        evaluation.TriggeredBy.toLowerCase().includes(query) ||
        evaluation.Type.toLowerCase().includes(query) ||
        evaluation.Namespace?.toLowerCase().includes(query)
    );
  }, [evaluations, searchQuery]);

  if (loading) {
    return <Loader title="Loading evaluations..." />;
  }

  if (error) {
    return <ErrorPage message="Error loading evaluations" error={error} />;
  }

  return (
    <SectionBox
      title={
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h5" component="span">
            Evaluations
          </Typography>
          <EvaluationStatsSummary stats={stats} />
        </Box>
      }
      headerProps={{
        actions: [
          <TextField
            key="search"
            size="small"
            placeholder="Search evaluations..."
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
            <IconButton onClick={loadEvaluations} size="small">
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
            getter: (evaluation: Evaluation) => (
              <Link
                component={RouterLink}
                to={createRouteURL('nomadEvaluation', { id: evaluation.ID })}
              >
                <CopyableId id={evaluation.ID} />
              </Link>
            ),
          },
          {
            label: 'Namespace',
            getter: (evaluation: Evaluation) => (
              <Chip
                label={evaluation.Namespace || 'default'}
                size="small"
                variant="outlined"
              />
            ),
          },
          {
            label: 'Job',
            getter: (evaluation: Evaluation) => (
              <Link
                component={RouterLink}
                to={createRouteURL('nomadJob', {
                  name: evaluation.JobID,
                  namespace: evaluation.Namespace || 'default',
                })}
              >
                {evaluation.JobID}
              </Link>
            ),
          },
          {
            label: 'Triggered By',
            getter: (evaluation: Evaluation) => (
              <Chip
                label={evaluation.TriggeredBy}
                size="small"
                variant="outlined"
                sx={{ textTransform: 'capitalize' }}
              />
            ),
          },
          {
            label: 'Status',
            getter: (evaluation: Evaluation) => (
              <StatusChip status={evaluation.Status} />
            ),
          },
          {
            label: 'Priority',
            getter: (evaluation: Evaluation) => (
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {evaluation.Priority}
              </Typography>
            ),
          },
          {
            label: 'Type',
            getter: (evaluation: Evaluation) => (
              <Chip label={evaluation.Type} size="small" variant="outlined" />
            ),
          },
          {
            label: 'Created',
            getter: (evaluation: Evaluation) =>
              evaluation.CreateTime ? (
                <DateLabel date={new Date(evaluation.CreateTime / 1000000)} />
              ) : (
                '-'
              ),
          },
        ]}
        data={filteredEvaluations}
        emptyMessage="No evaluations found"
      />
    </SectionBox>
  );
}
