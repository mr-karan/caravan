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
import { getService } from '../../../lib/nomad/api';
import { ServiceRegistration } from '../../../lib/nomad/types';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import BackLink from '../../common/BackLink';
import { CopyableId, CopyableText } from '../CopyButton';
import { MinimalStatus, InlineBadge } from '../statusStyles';
import { useNamespace, ALL_NAMESPACES } from '../../../lib/nomad/namespaceContext';
import NamespaceSwitcher from '../NamespaceSwitcher';

// Info row component
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 140, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ flex: 1 }}>
        {value}
      </Typography>
    </Box>
  );
}

// Group registrations by datacenter
function groupByDatacenter(registrations: ServiceRegistration[]): Record<string, ServiceRegistration[]> {
  return registrations.reduce((acc, reg) => {
    const dc = reg.Datacenter || 'unknown';
    if (!acc[dc]) {
      acc[dc] = [];
    }
    acc[dc].push(reg);
    return acc;
  }, {} as Record<string, ServiceRegistration[]>);
}

export default function ServiceDetails() {
  const { name } = useParams<{ name: string }>();
  const theme = useTheme();
  const { namespace } = useNamespace();
  const [registrations, setRegistrations] = useState<ServiceRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
    return <Loader title="Loading service..." />;
  }

  if (error) {
    return <ErrorPage message="Error loading service" error={error} />;
  }

  if (registrations.length === 0) {
    return (
      <Box>
        <BackLink />
        <SectionBox title={`Service: ${name}`}>
          <Typography color="text.secondary">No registrations found for this service</Typography>
        </SectionBox>
      </Box>
    );
  }

  // Get unique values for summary
  const uniqueDatacenters = [...new Set(registrations.map(r => r.Datacenter))];
  const uniqueJobs = [...new Set(registrations.map(r => r.JobID))];
  const uniqueNodes = [...new Set(registrations.map(r => r.NodeID))];
  const allTags = [...new Set(registrations.flatMap(r => r.Tags || []))];
  const groupedByDC = groupByDatacenter(registrations);

  // Get first registration for common info
  const firstReg = registrations[0];

  return (
    <Box>
      <BackLink />

      <SectionBox
        title={
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h5" component="span">
              {name}
            </Typography>
            <Chip
              label={`${registrations.length} instance${registrations.length !== 1 ? 's' : ''}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
        }
        headerProps={{
          actions: [
            <NamespaceSwitcher key="namespace" />,
            <Tooltip key="refresh" title="Refresh">
              <IconButton onClick={loadData} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>,
          ],
        }}
      >
        <Grid container spacing={3}>
          {/* Summary Card */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                SERVICE SUMMARY
              </Typography>

              <InfoRow label="Service Name" value={name} />
              <InfoRow
                label="Namespace"
                value={<Chip label={firstReg.Namespace} size="small" variant="outlined" />}
              />
              <InfoRow
                label="Datacenters"
                value={
                  <Box display="flex" gap={0.5} flexWrap="wrap">
                    {uniqueDatacenters.map(dc => (
                      <InlineBadge key={dc}>{dc}</InlineBadge>
                    ))}
                  </Box>
                }
              />
              <InfoRow label="Total Instances" value={registrations.length} />
              <InfoRow label="Unique Nodes" value={uniqueNodes.length} />
              <InfoRow label="Unique Jobs" value={uniqueJobs.length} />
            </Paper>
          </Grid>

          {/* Tags Card */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                TAGS
              </Typography>

              {allTags.length > 0 ? (
                <Box display="flex" gap={1} flexWrap="wrap">
                  {allTags.map((tag, idx) => (
                    <Chip key={idx} label={tag} size="small" variant="outlined" />
                  ))}
                </Box>
              ) : (
                <Typography color="text.secondary">No tags</Typography>
              )}
            </Paper>
          </Grid>

          {/* Instances by Datacenter */}
          {Object.entries(groupedByDC).map(([dc, dcRegistrations]) => (
            <Grid size={12} key={dc}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Typography variant="subtitle2" color="text.secondary">
                    DATACENTER:
                  </Typography>
                  <InlineBadge>{dc}</InlineBadge>
                  <Chip
                    label={`${dcRegistrations.length} instance${dcRegistrations.length !== 1 ? 's' : ''}`}
                    size="small"
                    sx={{ ml: 1 }}
                  />
                </Box>

                <SimpleTable
                  columns={[
                    {
                      label: 'Address',
                      getter: (reg: ServiceRegistration) => (
                        <CopyableText
                          value={`${reg.Address}:${reg.Port}`}
                          fontFamily="monospace"
                        />
                      ),
                    },
                    {
                      label: 'Port',
                      getter: (reg: ServiceRegistration) => reg.Port,
                    },
                    {
                      label: 'Node',
                      getter: (reg: ServiceRegistration) => (
                        <Link
                          component={RouterLink}
                          to={createRouteURL('nomadNode', { id: reg.NodeID })}
                        >
                          <CopyableId id={reg.NodeID} />
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
                        >
                          <CopyableId id={reg.AllocID} />
                        </Link>
                      ),
                    },
                    {
                      label: 'Tags',
                      getter: (reg: ServiceRegistration) => (
                        <Box display="flex" gap={0.5} flexWrap="wrap">
                          {reg.Tags && reg.Tags.length > 0 ? (
                            reg.Tags.slice(0, 3).map((tag, idx) => (
                              <Chip key={idx} label={tag} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                            ))
                          ) : (
                            <Typography variant="caption" color="text.secondary">-</Typography>
                          )}
                          {reg.Tags && reg.Tags.length > 3 && (
                            <Tooltip title={reg.Tags.slice(3).join(', ')}>
                              <Chip label={`+${reg.Tags.length - 3}`} size="small" />
                            </Tooltip>
                          )}
                        </Box>
                      ),
                    },
                  ]}
                  data={dcRegistrations}
                  emptyMessage="No instances"
                />
              </Paper>
            </Grid>
          ))}
        </Grid>
      </SectionBox>

      {/* All Registrations Table */}
      <SectionBox title={`All Registrations (${registrations.length})`} sx={{ mt: 3 }}>
        <SimpleTable
          columns={[
            {
              label: 'ID',
              getter: (reg: ServiceRegistration) => <CopyableId id={reg.ID} />,
            },
            {
              label: 'Address',
              getter: (reg: ServiceRegistration) => (
                <CopyableText value={`${reg.Address}:${reg.Port}`} fontFamily="monospace" />
              ),
            },
            {
              label: 'Datacenter',
              getter: (reg: ServiceRegistration) => <InlineBadge>{reg.Datacenter}</InlineBadge>,
            },
            {
              label: 'Namespace',
              getter: (reg: ServiceRegistration) => (
                <Chip label={reg.Namespace} size="small" variant="outlined" />
              ),
            },
            {
              label: 'Node',
              getter: (reg: ServiceRegistration) => (
                <Link
                  component={RouterLink}
                  to={createRouteURL('nomadNode', { id: reg.NodeID })}
                >
                  <CopyableId id={reg.NodeID} />
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
                >
                  <CopyableId id={reg.AllocID} />
                </Link>
              ),
            },
          ]}
          data={registrations}
          emptyMessage="No registrations"
        />
      </SectionBox>
    </Box>
  );
}
