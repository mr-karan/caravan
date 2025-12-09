import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  Box,
  Button,
  IconButton,
  Tooltip,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import { SectionBox, Loader, ErrorPage } from '../../common';
import { getVariable } from '../../../lib/nomad/api';
import { Variable } from '../../../lib/nomad/types';
import { DateLabel } from '../../common/Label';

export default function VariableDetails() {
  const { path, namespace } = useParams<{ path: string; namespace?: string }>();
  const decodedPath = decodeURIComponent(path || '');
  const [variable, setVariable] = useState<Variable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const loadVariable = useCallback(async () => {
    if (!decodedPath) return;

    try {
      setLoading(true);
      const data = await getVariable(decodedPath, namespace);
      setVariable(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [decodedPath, namespace]);

  useEffect(() => {
    loadVariable();
  }, [loadVariable]);

  const toggleVisibility = (key: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Check if all keys are visible
  const allKeys = useMemo(() => {
    return variable?.Items ? Object.keys(variable.Items) : [];
  }, [variable]);

  const allVisible = useMemo(() => {
    return allKeys.length > 0 && allKeys.every(key => visibleKeys.has(key));
  }, [allKeys, visibleKeys]);

  const toggleAllVisibility = () => {
    if (allVisible) {
      // Hide all
      setVisibleKeys(new Set());
    } else {
      // Show all
      setVisibleKeys(new Set(allKeys));
    }
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (loading) {
    return <Loader title="Loading variable..." />;
  }

  if (error) {
    return <ErrorPage message="Error loading variable" error={error} />;
  }

  if (!variable) {
    return <ErrorPage message="Variable not found" error={new Error('Variable not found')} />;
  }

  const items = variable.Items || {};
  const itemCount = Object.keys(items).length;

  return (
    <Box>
      <SectionBox
        title={`Variable: ${variable.Path}`}
        headerProps={{
          actions: [
            <Tooltip key="refresh" title="Refresh">
              <IconButton onClick={loadVariable} size="small">
                <Icon icon="mdi:refresh" width={20} />
              </IconButton>
            </Tooltip>,
          ],
        }}
      >
        <Box sx={{ mb: 3 }}>
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <Box>
              <Typography variant="caption" color="text.secondary">
                Namespace
              </Typography>
              <Box>
                <Chip label={variable.Namespace} size="small" />
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Path
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {variable.Path}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Items
              </Typography>
              <Typography variant="body2">{itemCount}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Created
              </Typography>
              <Box>
                {variable.CreateTime ? (
                  <DateLabel date={new Date(variable.CreateTime / 1000000)} />
                ) : (
                  <Typography variant="body2">-</Typography>
                )}
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Modified
              </Typography>
              <Box>
                {variable.ModifyTime ? (
                  <DateLabel date={new Date(variable.ModifyTime / 1000000)} />
                ) : (
                  <Typography variant="body2">-</Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </SectionBox>

      <SectionBox
        title="Items"
        headerProps={{
          actions: itemCount > 0 ? [
            <Button
              key="toggle-all"
              size="small"
              variant="outlined"
              onClick={toggleAllVisibility}
              startIcon={
                <Icon
                  icon={allVisible ? 'mdi:eye-off-outline' : 'mdi:eye-outline'}
                  width={18}
                />
              }
              sx={{ textTransform: 'none' }}
            >
              {allVisible ? 'Hide All' : 'Reveal All'}
            </Button>,
          ] : [],
        }}
      >
        {itemCount === 0 ? (
          <Typography color="text.secondary">No items in this variable</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Key</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Value</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: 100 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(items).map(([key, value]) => (
                  <TableRow key={key} hover>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', fontWeight: 500 }}
                      >
                        {key}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                          maxWidth: 500,
                        }}
                      >
                        {visibleKeys.has(key) ? value : '••••••••'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5}>
                        <Tooltip title={visibleKeys.has(key) ? 'Hide' : 'Show'}>
                          <IconButton size="small" onClick={() => toggleVisibility(key)}>
                            <Icon
                              icon={visibleKeys.has(key) ? 'mdi:eye-off-outline' : 'mdi:eye-outline'}
                              width={18}
                            />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Copy value">
                          <IconButton size="small" onClick={() => copyToClipboard(value)}>
                            <Icon icon="mdi:content-copy" width={18} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionBox>
    </Box>
  );
}
