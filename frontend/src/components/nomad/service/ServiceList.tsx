import React, { useEffect, useState, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  alpha,
  Box,
  Chip,
  IconButton,
  Link,
  Paper,
  Skeleton,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { SimpleTable, ErrorPage } from '../../common';
import { listServices, getService } from '../../../lib/nomad/api';
import { ServiceRegistration } from '../../../lib/nomad/types';
import { useNamespace, ALL_NAMESPACES } from '../../../lib/nomad/namespaceContext';
import NamespaceSwitcher from '../NamespaceSwitcher';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { minimalStatusColors } from '../statusStyles';

interface ServicesByNamespace {
  Namespace: string;
  Services: Array<{ ServiceName: string; Tags: string[] }>;
}

interface EnhancedService {
  Namespace: string;
  ServiceName: string;
  Tags: string[];
  InstanceCount?: number;
  Addresses?: string[];
}

function getServiceDetailUrl(serviceName: string, namespace: string) {
  const baseUrl = createRouteURL('nomadService', { name: serviceName });
  return `${baseUrl}?ns=${encodeURIComponent(namespace)}`;
}

export default function ServiceList() {
  const theme = useTheme();
  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;
  const { namespace } = useNamespace();
  const [services, setServices] = useState<EnhancedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      const params = namespace === ALL_NAMESPACES ? { namespace: '*' } : { namespace };
      const data = (await listServices(params)) as unknown as ServicesByNamespace[];

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
      <Box sx={{ pb: 3 }}>
        <Skeleton variant="rectangular" height={50} sx={{ borderRadius: 1, mb: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  if (error) {
    return <ErrorPage message="Error loading services" error={error} />;
  }

  const totalInstances = services.reduce((sum, s) => sum + (s.InstanceCount || 0), 0);

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
            Services
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.8rem' }}>
            {services.length}
          </Typography>
        </Box>

        {/* Inline Stats */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
            <Typography variant="caption" sx={{ color: colors.success, fontWeight: 600, fontSize: '0.8rem' }}>
              {totalInstances}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>instances</Typography>
          </Box>
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, mb: 2 }}>
        <NamespaceSwitcher />
        <Tooltip title="Refresh">
          <IconButton onClick={loadServices} size="small" sx={{ p: 0.75 }}>
            <Icon icon="mdi:refresh" width={18} />
          </IconButton>
        </Tooltip>
      </Box>

      {services.length === 0 ? (
        <Paper elevation={0} sx={{ p: 3, textAlign: 'center', borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>No services found</Typography>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
          <SimpleTable
            columns={[
              {
                label: 'Name',
                getter: (service: EnhancedService) => (
                  <Link
                    component={RouterLink}
                    to={getServiceDetailUrl(service.ServiceName, service.Namespace)}
                    sx={{ fontWeight: 500, fontSize: '0.85rem' }}
                  >
                    {service.ServiceName}
                  </Link>
                ),
              },
              {
                label: 'Namespace',
                getter: (service: EnhancedService) => (
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                    {service.Namespace}
                  </Typography>
                ),
              },
              {
                label: 'Instances',
                getter: (service: EnhancedService) => (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: service.InstanceCount && service.InstanceCount > 0 ? colors.success : colors.cancelled,
                      }}
                    />
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                      {service.InstanceCount || 0}
                    </Typography>
                  </Box>
                ),
                gridTemplate: 'auto',
              },
              {
                label: 'Addresses',
                getter: (service: EnhancedService) => (
                  service.Addresses && service.Addresses.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {service.Addresses.slice(0, 2).map((addr, idx) => (
                        <Typography
                          key={idx}
                          variant="caption"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.65rem',
                            backgroundColor: alpha(theme.palette.text.primary, 0.05),
                            px: 0.5,
                            py: 0.125,
                            borderRadius: 0.5,
                          }}
                        >
                          {addr}
                        </Typography>
                      ))}
                      {service.Addresses.length > 2 && (
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                          +{service.Addresses.length - 2}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                  )
                ),
              },
              {
                label: 'Tags',
                getter: (service: EnhancedService) => (
                  service.Tags && service.Tags.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {service.Tags.slice(0, 3).map((tag, idx) => (
                        <Chip key={idx} label={tag} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                      ))}
                      {service.Tags.length > 3 && (
                        <Tooltip title={service.Tags.slice(3).join(', ')}>
                          <Chip size="small" label={`+${service.Tags.length - 3}`} sx={{ fontSize: '0.6rem', height: 18 }} />
                        </Tooltip>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                  )
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
