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
  Paper,
  Skeleton,
  alpha,
  useTheme,
} from '@mui/material';
import { Icon } from '@iconify/react';
import { SimpleTable, ErrorPage } from '../../common';
import { listEvaluations } from '../../../lib/nomad/api';
import { Evaluation } from '../../../lib/nomad/types';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { useNamespace, ALL_NAMESPACES } from '../../../lib/nomad/namespaceContext';
import NamespaceSwitcher from '../NamespaceSwitcher';
import { MinimalStatus, minimalStatusColors } from '../statusStyles';

export default function EvaluationList() {
  const theme = useTheme();
  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;
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

  const stats = useMemo(() => {
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
    return (
      <Box sx={{ pb: 3 }}>
        <Skeleton variant="rectangular" height={50} sx={{ borderRadius: 1, mb: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  if (error) {
    return <ErrorPage message="Error loading evaluations" error={error} />;
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
            Evaluations
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.8rem' }}>
            {stats.total}
          </Typography>
        </Box>

        {/* Inline Stats */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {stats.pending > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
              <Typography variant="caption" sx={{ color: colors.pending, fontWeight: 600, fontSize: '0.8rem' }}>
                {stats.pending}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>pending</Typography>
            </Box>
          )}
          {stats.blocked > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
              <Typography variant="caption" sx={{ color: colors.pending, fontWeight: 600, fontSize: '0.8rem' }}>
                {stats.blocked}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>blocked</Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
            <Typography variant="caption" sx={{ color: colors.success, fontWeight: 600, fontSize: '0.8rem' }}>
              {stats.complete}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>complete</Typography>
          </Box>
          {stats.failed > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
              <Typography variant="caption" sx={{ color: colors.error, fontWeight: 600, fontSize: '0.8rem' }}>
                {stats.failed}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>failed</Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search evaluations..."
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

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <NamespaceSwitcher />
          <Tooltip title="Refresh">
            <IconButton onClick={loadEvaluations} size="small" sx={{ p: 0.75 }}>
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
              label: 'ID',
              getter: (evaluation: Evaluation) => (
                <Link
                  component={RouterLink}
                  to={createRouteURL('nomadEvaluation', { id: evaluation.ID })}
                  sx={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 500 }}
                >
                  {evaluation.ID.substring(0, 8)}
                </Link>
              ),
            },
            {
              label: 'Status',
              getter: (evaluation: Evaluation) => <MinimalStatus status={evaluation.Status} />,
              gridTemplate: 'auto',
            },
            {
              label: 'Job',
              getter: (evaluation: Evaluation) => (
                <Link
                  component={RouterLink}
                  to={createRouteURL('nomadJob', { name: evaluation.JobID, namespace: evaluation.Namespace || 'default' })}
                  sx={{ fontSize: '0.8rem' }}
                >
                  {evaluation.JobID}
                </Link>
              ),
            },
            {
              label: 'Namespace',
              getter: (evaluation: Evaluation) => (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  {evaluation.Namespace || 'default'}
                </Typography>
              ),
              gridTemplate: 'auto',
            },
            {
              label: 'Triggered By',
              getter: (evaluation: Evaluation) => (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.7rem',
                    textTransform: 'capitalize',
                    backgroundColor: alpha(theme.palette.text.primary, 0.05),
                    px: 0.75,
                    py: 0.125,
                    borderRadius: 0.5,
                  }}
                >
                  {evaluation.TriggeredBy}
                </Typography>
              ),
            },
            {
              label: 'Type',
              getter: (evaluation: Evaluation) => (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  {evaluation.Type}
                </Typography>
              ),
            },
            {
              label: 'Priority',
              getter: (evaluation: Evaluation) => (
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'text.secondary' }}>
                  {evaluation.Priority}
                </Typography>
              ),
              gridTemplate: 'auto',
            },
            {
              label: 'Created',
              getter: (evaluation: Evaluation) =>
                evaluation.CreateTime ? <DateLabel date={new Date(evaluation.CreateTime / 1000000)} format="mini" /> : '—',
              gridTemplate: 'auto',
            },
          ]}
          data={filteredEvaluations}
          emptyMessage="No evaluations found"
        />
      </Paper>
    </Box>
  );
}
