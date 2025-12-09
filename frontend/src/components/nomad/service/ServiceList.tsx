import React, { useEffect, useState, useCallback } from 'react';
import { Chip, IconButton, Tooltip, Box, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { SectionBox, SimpleTable, Loader, ErrorPage } from '../../common';
import { listServices } from '../../../lib/nomad/api';
import { useNamespace, ALL_NAMESPACES } from '../../../lib/nomad/namespaceContext';
import NamespaceSwitcher from '../NamespaceSwitcher';

// Nomad services API returns a nested structure by namespace
interface ServicesByNamespace {
  Namespace: string;
  Services: Array<{
    ServiceName: string;
    Tags: string[];
  }>;
}

// Flattened service for display
interface FlattenedService {
  Namespace: string;
  ServiceName: string;
  Tags: string[];
}

export default function ServiceList() {
  
  const { namespace } = useNamespace();
  const [services, setServices] = useState<FlattenedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      const params = namespace === ALL_NAMESPACES ? { namespace: '*' } : { namespace };
      const data = await listServices(params) as unknown as ServicesByNamespace[];

      // Flatten the nested structure
      const flattened: FlattenedService[] = [];
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

      setServices(flattened);
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
    return <Loader title="Loading services..." />;
  }

  if (error) {
    return <ErrorPage message="Error loading services" error={error} />;
  }

  return (
    <SectionBox
      title="Services"
      headerProps={{
        actions: [
          <NamespaceSwitcher key="namespace" />,
          <Tooltip key="refresh" title="Refresh">
            <IconButton onClick={loadServices} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>,
        ],
      }}
    >
      <SimpleTable
        columns={[
          {
            label: 'Service Name',
            getter: (service: FlattenedService) => (
              <Typography>{service.ServiceName}</Typography>
            ),
          },
          {
            label: 'Namespace',
            getter: (service: FlattenedService) => service.Namespace || 'default',
          },
          {
            label: 'Tags',
            getter: (service: FlattenedService) => (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {service.Tags && service.Tags.length > 0 ? (
                  service.Tags.map((tag, idx) => (
                    <Chip key={idx} label={tag} size="small" variant="outlined" />
                  ))
                ) : (
                  '-'
                )}
              </Box>
            ),
          },
        ]}
        data={services}
        emptyMessage="No services found"
      />
    </SectionBox>
  );
}
