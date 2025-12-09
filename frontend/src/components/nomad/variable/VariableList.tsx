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
import { listVariables } from '../../../lib/nomad/api';
import { VariableMetadata } from '../../../lib/nomad/types';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { useNamespace, ALL_NAMESPACES } from '../../../lib/nomad/namespaceContext';
import NamespaceSwitcher from '../NamespaceSwitcher';

function getPathPrefix(path: string): string {
  const parts = path.split('/');
  if (parts.length > 1) return parts[0];
  return '';
}

export default function VariableList() {
  const theme = useTheme();
  const { namespace } = useNamespace();
  const [variables, setVariables] = useState<VariableMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadVariables = useCallback(async () => {
    try {
      setLoading(true);
      const params = namespace === ALL_NAMESPACES ? { namespace: '*' } : { namespace };
      const data = await listVariables(params);
      setVariables(data || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [namespace]);

  useEffect(() => {
    loadVariables();
  }, [loadVariables]);

  const prefixStats = useMemo(() => {
    const stats: Record<string, number> = {};
    variables.forEach(v => {
      const prefix = getPathPrefix(v.Path) || 'root';
      stats[prefix] = (stats[prefix] || 0) + 1;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [variables]);

  const filteredVariables = useMemo(() => {
    if (!searchQuery.trim()) return variables;
    const query = searchQuery.toLowerCase();
    return variables.filter(
      variable =>
        variable.Path.toLowerCase().includes(query) ||
        variable.Namespace.toLowerCase().includes(query) ||
        getPathPrefix(variable.Path).toLowerCase().includes(query)
    );
  }, [variables, searchQuery]);

  if (loading) {
    return (
      <Box sx={{ pb: 3 }}>
        <Skeleton variant="rectangular" height={50} sx={{ borderRadius: 1, mb: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  if (error) {
    return <ErrorPage message="Error loading variables" error={error} />;
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
            Variables
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.8rem' }}>
            {variables.length}
          </Typography>
        </Box>

        {/* Inline Prefix Stats */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {prefixStats.map(([prefix, count]) => (
            <Box key={prefix} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem' }}>
                {count}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                {prefix}/
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search variables..."
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
            <IconButton onClick={loadVariables} size="small" sx={{ p: 0.75 }}>
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
              label: 'Path',
              getter: (variable: VariableMetadata) => (
                <Link
                  component={RouterLink}
                  to={createRouteURL('nomadVariable', { path: variable.Path, namespace: variable.Namespace })}
                  sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                >
                  {variable.Path}
                </Link>
              ),
            },
            {
              label: 'Namespace',
              getter: (variable: VariableMetadata) => (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  {variable.Namespace}
                </Typography>
              ),
              gridTemplate: 'auto',
            },
            {
              label: 'Prefix',
              getter: (variable: VariableMetadata) => {
                const prefix = getPathPrefix(variable.Path);
                if (!prefix) {
                  return <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>;
                }
                return (
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.7rem',
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      px: 0.75,
                      py: 0.125,
                      borderRadius: 0.5,
                    }}
                  >
                    {prefix}
                  </Typography>
                );
              },
              gridTemplate: 'auto',
            },
            {
              label: 'Created',
              getter: (variable: VariableMetadata) =>
                variable.CreateTime ? <DateLabel date={new Date(variable.CreateTime / 1000000)} format="mini" /> : '—',
              gridTemplate: 'auto',
            },
            {
              label: 'Modified',
              getter: (variable: VariableMetadata) =>
                variable.ModifyTime ? <DateLabel date={new Date(variable.ModifyTime / 1000000)} format="mini" /> : '—',
              gridTemplate: 'auto',
            },
          ]}
          data={filteredVariables}
          emptyMessage="No variables found"
        />
      </Paper>
    </Box>
  );
}
