import React, { useEffect, useState, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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
import { SectionBox, SimpleTable, Loader, ErrorPage } from '../../common';
import { listServices, getService } from '../../../lib/nomad/api';
import { ServiceRegistration } from '../../../lib/nomad/types';
import { useNamespace, ALL_NAMESPACES } from '../../../lib/nomad/namespaceContext';
import NamespaceSwitcher from '../NamespaceSwitcher';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { useViewPreference } from '../../../lib/useViewPreference';

// Nomad services API returns a nested structure by namespace
interface ServicesByNamespace {
  Namespace: string;
  Services: Array<{
    ServiceName: string;
    Tags: string[];
  }>;
}

// Enhanced service with instance count
interface EnhancedService {
  Namespace: string;
  ServiceName: string;
  Tags: string[];
  InstanceCount?: number;
  Addresses?: string[];
}

// Service card component
function ServiceCard({ service }: { service: EnhancedService }) {
  const theme = useTheme();

  return (
    <Card
      elevation={0}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        height: '100%',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: theme.palette.primary.main,
          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon icon="mdi:lan" width={22} color={theme.palette.primary.main} />
            </Box>
            <Box>
              <Link
                component={RouterLink}
                to={createRouteURL('nomadService', { name: service.ServiceName })}
                sx={{
                  fontWeight: 600,
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {service.ServiceName}
              </Link>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {service.Namespace}
              </Typography>
            </Box>
          </Box>
          {service.InstanceCount !== undefined && (
            <Chip
              size="small"
              label={`${service.InstanceCount} instance${service.InstanceCount !== 1 ? 's' : ''}`}
              color={service.InstanceCount > 0 ? 'success' : 'default'}
              sx={{ fontWeight: 500, fontSize: '0.7rem' }}
            />
          )}
        </Box>

        {service.Tags && service.Tags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {service.Tags.slice(0, 4).map((tag, idx) => (
              <Chip
                key={idx}
                label={tag}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
            {service.Tags.length > 4 && (
              <Tooltip title={service.Tags.slice(4).join(', ')}>
                <Chip
                  size="small"
                  label={`+${service.Tags.length - 4}`}
                  sx={{ fontSize: '0.7rem' }}
                />
              </Tooltip>
            )}
          </Box>
        )}

        {service.Addresses && service.Addresses.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Addresses
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {service.Addresses.slice(0, 2).map((addr, idx) => (
                <Typography
                  key={idx}
                  variant="caption"
                  sx={{
                    fontFamily: 'monospace',
                    backgroundColor: alpha(theme.palette.text.primary, 0.05),
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                  }}
                >
                  {addr}
                </Typography>
              ))}
              {service.Addresses.length > 2 && (
                <Typography variant="caption" color="text.secondary">
                  +{service.Addresses.length - 2} more
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default function ServiceList() {
  const theme = useTheme();
  const { namespace } = useNamespace();
  const [services, setServices] = useState<EnhancedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [viewMode, , toggleViewMode] = useViewPreference();

  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      const params = namespace === ALL_NAMESPACES ? { namespace: '*' } : { namespace };
      const data = (await listServices(params)) as unknown as ServicesByNamespace[];

      // Flatten the nested structure
      const flattened: EnhancedService[] = [];
      if (data && Array.isArray(data)) {
        for (const nsGroup of data) {
          if (nsGroup.Services && Array.isArray(nsGroup.Services)) {
            for (const svc of nsGroup.Services) {
              flattened.push({
                Namespace: nsGroup.Namespace,
                ServiceName: svc.ServiceName,
                Tags: svc.Tags || [],
              });
            }
          }
        }
      }

      // Fetch instance counts for each service (in parallel, but limit concurrency)
      const enriched = await Promise.all(
        flattened.map(async svc => {
          try {
            const registrations = await getService(svc.ServiceName, svc.Namespace);
            return {
              ...svc,
              InstanceCount: registrations?.length || 0,
              Addresses: registrations?.slice(0, 3).map((r: ServiceRegistration) => `${r.Address}:${r.Port}`) || [],
            };
          } catch {
            return { ...svc, InstanceCount: 0, Addresses: [] };
          }
        })
      );

      setServices(enriched);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [namespace]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  if (loading) {
    return (
      <Box>
        <SectionBox
          title="Services"
          headerProps={{
            actions: [
              <NamespaceSwitcher key="namespace" />,
              <IconButton key="refresh" size="small" disabled>
                <Icon icon="mdi:refresh" width={20} />
              </IconButton>,
            ],
          }}
        >
          <Grid container spacing={2}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2 }} />
              </Grid>
            ))}
          </Grid>
        </SectionBox>
      </Box>
    );
  }

  if (error) {
    return <ErrorPage message="Error loading services" error={error} />;
  }

  const totalInstances = services.reduce((sum, s) => sum + (s.InstanceCount || 0), 0);

  return (
    <Box>
      {/* Header stats */}
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 4 }}>
            <Box>
              <Typography variant="h4" fontWeight={600}>
                {services.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Services
              </Typography>
            </Box>
            <Box>
              <Typography variant="h4" fontWeight={600}>
                {totalInstances}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Instances
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <NamespaceSwitcher />
            <Tooltip title={viewMode === 'grid' ? 'Table view' : 'Grid view'}>
              <IconButton onClick={toggleViewMode} size="small">
                <Icon icon={viewMode === 'grid' ? 'mdi:format-list-bulleted' : 'mdi:view-grid'} width={20} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={loadServices} size="small">
                <Icon icon="mdi:refresh" width={20} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {services.length === 0 ? (
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
            No services found
          </Typography>
        </Paper>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {services.map(service => (
            <Grid key={`${service.Namespace}-${service.ServiceName}`} size={{ xs: 12, sm: 6, md: 4 }}>
              <ServiceCard service={service} />
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
                label: 'Service Name',
                getter: (service: EnhancedService) => (
                  <Link
                    component={RouterLink}
                    to={createRouteURL('nomadService', { name: service.ServiceName })}
                    sx={{ fontWeight: 500 }}
                  >
                    {service.ServiceName}
                  </Link>
                ),
              },
              {
                label: 'Namespace',
                getter: (service: EnhancedService) => (
                  <Chip label={service.Namespace} size="small" variant="outlined" />
                ),
              },
              {
                label: 'Instances',
                getter: (service: EnhancedService) => (
                  <Chip
                    size="small"
                    label={service.InstanceCount || 0}
                    color={service.InstanceCount && service.InstanceCount > 0 ? 'success' : 'default'}
                  />
                ),
              },
              {
                label: 'Tags',
                getter: (service: EnhancedService) => (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {service.Tags && service.Tags.length > 0 ? (
                      <>
                        {service.Tags.slice(0, 3).map((tag, idx) => (
                          <Chip key={idx} label={tag} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                        ))}
                        {service.Tags.length > 3 && (
                          <Chip size="small" label={`+${service.Tags.length - 3}`} sx={{ fontSize: '0.7rem' }} />
                        )}
                      </>
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </Box>
                ),
              },
            ]}
            data={services}
            emptyMessage="No services found"
          />
        </Paper>
      )}
    </Box>
  );
}
