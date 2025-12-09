import React, { useEffect, useState, useCallback } from 'react';
import { IconButton, Tooltip, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { SectionBox, SimpleTable, Loader, ErrorPage } from '../../common';
import { listNamespaces } from '../../../lib/nomad/api';
import { Namespace } from '../../../lib/nomad/types';

export default function NamespaceList() {
  
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadNamespaces = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listNamespaces();
      setNamespaces(data || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNamespaces();
  }, [loadNamespaces]);

  if (loading) {
    return <Loader title="Loading namespaces..." />;
  }

  if (error) {
    return <ErrorPage message="Error loading namespaces" error={error} />;
  }

  return (
    <SectionBox
      title="Namespaces"
      headerProps={{
        actions: [
          <Tooltip key="refresh" title="Refresh">
            <IconButton onClick={loadNamespaces} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>,
        ],
      }}
    >
      <SimpleTable
        columns={[
          {
            label: 'Name',
            getter: (ns: Namespace) => (
              <Typography fontWeight="medium">{ns.Name}</Typography>
            ),
          },
          {
            label: 'Description',
            getter: (ns: Namespace) => ns.Description || '-',
          },
          {
            label: 'Quota',
            getter: (ns: Namespace) => ns.Quota || '-',
          },
        ]}
        data={namespaces}
        emptyMessage="No namespaces found"
      />
    </SectionBox>
  );
}
