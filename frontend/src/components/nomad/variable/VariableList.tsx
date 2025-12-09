import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Link,
  IconButton,
  Tooltip,
  Chip,
  Box,
  Typography,
  TextField,
  InputAdornment,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import { SectionBox, SimpleTable, Loader, ErrorPage } from '../../common';
import { listVariables } from '../../../lib/nomad/api';
import { VariableMetadata } from '../../../lib/nomad/types';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { useNamespace, ALL_NAMESPACES } from '../../../lib/nomad/namespaceContext';
import NamespaceSwitcher from '../NamespaceSwitcher';
import { CopyableText } from '../CopyButton';

// Get path prefix for grouping
function getPathPrefix(path: string): string {
  const parts = path.split('/');
  if (parts.length > 1) {
    return parts[0];
  }
  return '';
}

// Get color for prefix (consistent color per prefix)
function getPrefixColor(prefix: string): { bg: string; color: string; border: string } {
  const colors = [
    { bg: '#e3f2fd', color: '#1565c0', border: '#1976d2' }, // blue
    { bg: '#e8f5e9', color: '#2e7d32', border: '#4caf50' }, // green
    { bg: '#fff3e0', color: '#e65100', border: '#ff9800' }, // orange
    { bg: '#f3e5f5', color: '#7b1fa2', border: '#9c27b0' }, // purple
    { bg: '#e0f7fa', color: '#00838f', border: '#00bcd4' }, // cyan
    { bg: '#fce4ec', color: '#c2185b', border: '#e91e63' }, // pink
  ];

  // Special case for 'nomad' prefix
  if (prefix === 'nomad') {
    return { bg: '#e3f2fd', color: '#1565c0', border: '#1976d2' };
  }

  let hash = 0;
  for (let i = 0; i < prefix.length; i++) {
    hash = prefix.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Group variables by prefix for statistics
interface PrefixStats {
  [prefix: string]: number;
}

function VariableStatsSummary({ variables }: { variables: VariableMetadata[] }) {
  const prefixStats = useMemo<PrefixStats>(() => {
    return variables.reduce((acc, v) => {
      const prefix = getPathPrefix(v.Path) || 'root';
      acc[prefix] = (acc[prefix] || 0) + 1;
      return acc;
    }, {} as PrefixStats);
  }, [variables]);

  const sortedPrefixes = Object.entries(prefixStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Show top 5 prefixes

  return (
    <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
      <Chip label={variables.length} size="small" variant="outlined" />
      {sortedPrefixes.map(([prefix, count]) => {
        const colors = getPrefixColor(prefix);
        return (
          <Tooltip key={prefix} title={`${count} variable${count > 1 ? 's' : ''} in ${prefix}/`}>
            <Chip
              icon={<FolderIcon sx={{ fontSize: 14 }} />}
              label={`${prefix}: ${count}`}
              size="small"
              sx={{
                backgroundColor: colors.bg,
                color: colors.color,
                border: `1px solid ${colors.border}`,
                '& .MuiChip-icon': { color: colors.color },
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}

export default function VariableList() {
  const { namespace } = useNamespace();
  const [variables, setVariables] = useState<VariableMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadVariables = useCallback(async () => {
    try {
      setLoading(true);
      // Use namespace=* to get variables from all namespaces, or specific namespace
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

  // Filter variables based on search
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
    return <Loader title="Loading variables..." />;
  }

  if (error) {
    return <ErrorPage message="Error loading variables" error={error} />;
  }

  return (
    <SectionBox
      title={
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h5" component="span">
            Variables
          </Typography>
          <VariableStatsSummary variables={variables} />
        </Box>
      }
      headerProps={{
        actions: [
          <TextField
            key="search"
            size="small"
            placeholder="Search variables..."
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
            <IconButton onClick={loadVariables} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>,
        ],
      }}
    >
      <SimpleTable
        columns={[
          {
            label: 'Path',
            getter: (variable: VariableMetadata) => (
              <Link
                component={RouterLink}
                to={createRouteURL('nomadVariable', {
                  path: variable.Path,
                  namespace: variable.Namespace,
                })}
                sx={{ fontFamily: 'monospace' }}
              >
                <CopyableText value={variable.Path} fontFamily="monospace" />
              </Link>
            ),
          },
          {
            label: 'Namespace',
            getter: (variable: VariableMetadata) => (
              <Chip label={variable.Namespace} size="small" variant="outlined" />
            ),
          },
          {
            label: 'Prefix',
            getter: (variable: VariableMetadata) => {
              const prefix = getPathPrefix(variable.Path);
              if (!prefix) {
                return (
                  <Typography variant="body2" color="text.secondary">
                    -
                  </Typography>
                );
              }
              const colors = getPrefixColor(prefix);
              return (
                <Chip
                  label={prefix}
                  size="small"
                  sx={{
                    backgroundColor: colors.bg,
                    color: colors.color,
                    border: `1px solid ${colors.border}`,
                  }}
                />
              );
            },
          },
          {
            label: 'Created',
            getter: (variable: VariableMetadata) =>
              variable.CreateTime ? (
                <DateLabel date={new Date(variable.CreateTime / 1000000)} />
              ) : (
                '-'
              ),
          },
          {
            label: 'Modified',
            getter: (variable: VariableMetadata) =>
              variable.ModifyTime ? (
                <DateLabel date={new Date(variable.ModifyTime / 1000000)} />
              ) : (
                '-'
              ),
          },
        ]}
        data={filteredVariables}
        emptyMessage="No variables found"
      />
    </SectionBox>
  );
}
