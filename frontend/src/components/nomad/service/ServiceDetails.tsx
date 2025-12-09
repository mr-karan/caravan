import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  alpha,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  Link,
  Paper,
  Skeleton,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { SimpleTable, ErrorPage } from '../../common';
import { getService } from '../../../lib/nomad/api';
import { ServiceRegistration } from '../../../lib/nomad/types';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import BackLink from '../../common/BackLink';
import { useNamespace, ALL_NAMESPACES } from '../../../lib/nomad/namespaceContext';
import NamespaceSwitcher from '../NamespaceSwitcher';
import { useViewPreference } from '../../../lib/useViewPreference';

// Stat card component
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: number | string;
  color: string;
}) {
  const theme = useTheme();

  return (
    <Card
      elevation={0}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        height: '100%',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              backgroundColor: alpha(color, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon={icon} width={20} color={color} />
          </Box>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            {label}
          </Typography>
        </Box>
        <Typography variant="h4" fontWeight={600}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

// Instance card component
function InstanceCard({ registration }: { registration: ServiceRegistration }) {
  const theme = useTheme();

  return (
    <Card
      elevation={0}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: theme.palette.primary.main,
          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        {/* Header with address */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              backgroundColor: alpha(theme.palette.success.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px solid ${alpha(theme.palette.success.main, 0.3)}`,
            }}
          >
            <Icon icon="mdi:server-network" width={22} color={theme.palette.success.main} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="subtitle1"
              fontWeight={600}
              sx={{ fontFamily: 'monospace', fontSize: '1rem' }}
            >
              {registration.Address}:{registration.Port}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {registration.Datacenter}
            </Typography>
          </Box>
          <Tooltip title="Copy address">
            <IconButton
              size="small"
              onClick={() => navigator.clipboard.writeText(`${registration.Address}:${registration.Port}`)}
            >
              <Icon icon="mdi:content-copy" width={16} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Info grid */}
        <Grid container spacing={2}>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Node
            </Typography>
            <Link
              component={RouterLink}
              to={createRouteURL('nomadNode', { id: registration.NodeID })}
              sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}
            >
              {registration.NodeID.substring(0, 8)}
            </Link>
          </Grid>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Allocation
            </Typography>
            <Link
              component={RouterLink}
              to={createRouteURL('nomadAllocation', { id: registration.AllocID })}
              sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}
            >
              {registration.AllocID.substring(0, 8)}
            </Link>
          </Grid>
          <Grid size={12}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Job
            </Typography>
            <Link
              component={RouterLink}
              to={createRouteURL('nomadJob', {
                name: registration.JobID,
                namespace: registration.Namespace,
              })}
              sx={{ fontSize: '0.875rem' }}
            >
              {registration.JobID}
            </Link>
          </Grid>
        </Grid>

        {/* Tags */}
        {registration.Tags && registration.Tags.length > 0 && (
          <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {registration.Tags.map((tag, idx) => (
                <Chip
                  key={idx}
                  label={tag}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default function ServiceDetails() {
  const { name } = useParams<{ name: string }>();
  const theme = useTheme();
  const { namespace } = useNamespace();
  const [registrations, setRegistrations] = useState<ServiceRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [viewMode, , toggleViewMode] = useViewPreference();

  const loadData = useCallback(async () => {
    if (!name) return;

    try {
      setLoading(true);
      const ns = namespace === ALL_NAMESPACES ? '*' : namespace;
      const data = await getService(name, ns);
      setRegistrations(data || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [name, namespace]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <Box>
        <BackLink />
        <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2, mb: 3 }} />
        <Grid container spacing={2}>
          {[1, 2, 3].map(i => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return <ErrorPage message="Error loading service" error={error} />;
  }

  // Get unique values for stats
  const uniqueDatacenters = [...new Set(registrations.map(r => r.Datacenter))];
  const uniqueNodes = [...new Set(registrations.map(r => r.NodeID))];
  const uniqueJobs = [...new Set(registrations.map(r => r.JobID))];
  const allTags = [...new Set(registrations.flatMap(r => r.Tags || []))];
  const firstReg = registrations[0];

  return (
    <Box>
      <BackLink />

      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, ${alpha(theme.palette.background.paper, 1)} 100%)`,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'flex-start' }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              }}
            >
              <Icon icon="mdi:lan" width={28} color={theme.palette.primary.main} />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                <Typography variant="h5" fontWeight={600}>
                  {name}
                </Typography>
                <Chip
                  label={`${registrations.length} instance${registrations.length !== 1 ? 's' : ''}`}
                  size="small"
                  color={registrations.length > 0 ? 'success' : 'default'}
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                {firstReg && (
                  <>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Icon icon="mdi:folder-outline" width={16} />
                      {firstReg.Namespace}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Icon icon="mdi:map-marker" width={16} />
                      {uniqueDatacenters.join(', ')}
                    </Typography>
                  </>
                )}
              </Box>

              {/* Tags */}
              {allTags.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1.5 }}>
                  {allTags.slice(0, 6).map((tag, idx) => (
                    <Chip key={idx} label={tag} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                  ))}
                  {allTags.length > 6 && (
                    <Chip size="small" label={`+${allTags.length - 6}`} sx={{ fontSize: '0.7rem' }} />
                  )}
                </Box>
              )}
            </Box>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <NamespaceSwitcher />
            <Tooltip title={viewMode === 'grid' ? 'Table view' : 'Card view'}>
              <IconButton onClick={toggleViewMode} size="small">
                <Icon icon={viewMode === 'grid' ? 'mdi:format-list-bulleted' : 'mdi:view-grid'} width={20} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={loadData} size="small">
                <Icon icon="mdi:refresh" width={20} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {registrations.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Icon icon="mdi:lan-disconnect" width={48} color={theme.palette.text.disabled} />
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No registrations found for this service
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Stats */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                icon="mdi:server-network"
                label="Instances"
                value={registrations.length}
                color={theme.palette.success.main}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                icon="mdi:server"
                label="Nodes"
                value={uniqueNodes.length}
                color={theme.palette.info.main}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                icon="mdi:briefcase-outline"
                label="Jobs"
                value={uniqueJobs.length}
                color={theme.palette.warning.main}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                icon="mdi:map-marker"
                label="Datacenters"
                value={uniqueDatacenters.length}
                color={theme.palette.primary.main}
              />
            </Grid>
          </Grid>

          {/* Instances */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
            INSTANCES
          </Typography>

          {viewMode === 'grid' ? (
            <Grid container spacing={2}>
              {registrations.map(reg => (
                <Grid key={reg.ID} size={{ xs: 12, sm: 6, md: 4 }}>
                  <InstanceCard registration={reg} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Paper
              elevation={0}
              sx={{
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                overflow: 'hidden',
              }}
            >
              <SimpleTable
                columns={[
                  {
                    label: 'Address',
                    getter: (reg: ServiceRegistration) => (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 500 }}>
                          {reg.Address}:{reg.Port}
                        </Typography>
                        <Tooltip title="Copy">
                          <IconButton
                            size="small"
                            onClick={() => navigator.clipboard.writeText(`${reg.Address}:${reg.Port}`)}
                          >
                            <Icon icon="mdi:content-copy" width={14} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ),
                  },
                  {
                    label: 'Datacenter',
                    getter: (reg: ServiceRegistration) => (
                      <Chip label={reg.Datacenter} size="small" variant="outlined" />
                    ),
                  },
                  {
                    label: 'Node',
                    getter: (reg: ServiceRegistration) => (
                      <Link
                        component={RouterLink}
                        to={createRouteURL('nomadNode', { id: reg.NodeID })}
                        sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                      >
                        {reg.NodeID.substring(0, 8)}
                      </Link>
                    ),
                  },
                  {
                    label: 'Job',
                    getter: (reg: ServiceRegistration) => (
                      <Link
                        component={RouterLink}
                        to={createRouteURL('nomadJob', {
                          name: reg.JobID,
                          namespace: reg.Namespace,
                        })}
                      >
                        {reg.JobID}
                      </Link>
                    ),
                  },
                  {
                    label: 'Allocation',
                    getter: (reg: ServiceRegistration) => (
                      <Link
                        component={RouterLink}
                        to={createRouteURL('nomadAllocation', { id: reg.AllocID })}
                        sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                      >
                        {reg.AllocID.substring(0, 8)}
                      </Link>
                    ),
                  },
                  {
                    label: 'Tags',
                    getter: (reg: ServiceRegistration) => (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {reg.Tags && reg.Tags.length > 0 ? (
                          <>
                            {reg.Tags.slice(0, 2).map((tag, idx) => (
                              <Chip key={idx} label={tag} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                            ))}
                            {reg.Tags.length > 2 && (
                              <Tooltip title={reg.Tags.slice(2).join(', ')}>
                                <Chip size="small" label={`+${reg.Tags.length - 2}`} sx={{ fontSize: '0.65rem' }} />
                              </Tooltip>
                            )}
                          </>
                        ) : (
                          <Typography variant="caption" color="text.secondary">—</Typography>
                        )}
                      </Box>
                    ),
                  },
                ]}
                data={registrations}
                emptyMessage="No registrations"
              />
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
