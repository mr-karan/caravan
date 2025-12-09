import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link as RouterLink, useSearchParams } from 'react-router-dom';
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
import { getService, getServiceAllNamespaces } from '../../../lib/nomad/api';
import { ServiceRegistration } from '../../../lib/nomad/types';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import BackLink from '../../common/BackLink';
import { useNamespace, ALL_NAMESPACES } from '../../../lib/nomad/namespaceContext';
import NamespaceSwitcher from '../NamespaceSwitcher';
import { useViewPreference } from '../../../lib/useViewPreference';
import { minimalStatusColors } from '../statusStyles';

// Compact stat item
function StatItem({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <Box sx={{ minWidth: 70 }}>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'block',
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: color || 'text.primary',
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

// Compact instance row
function InstanceRow({ registration }: { registration: ServiceRegistration }) {
  const theme = useTheme();
  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 100px 80px 100px 80px auto',
        gap: 2,
        py: 1,
        px: 1.5,
        alignItems: 'center',
        borderBottom: `1px solid ${theme.palette.divider}`,
        '&:last-child': { borderBottom: 'none' },
        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.02) },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.success }} />
        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 500 }}>
          {registration.Address}:{registration.Port}
        </Typography>
        <Tooltip title="Copy">
          <IconButton
            size="small"
            onClick={() => navigator.clipboard.writeText(`${registration.Address}:${registration.Port}`)}
            sx={{ p: 0.25 }}
          >
            <Icon icon="mdi:content-copy" width={12} />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
        {registration.Datacenter}
      </Typography>
      <Link
        component={RouterLink}
        to={createRouteURL('nomadNode', { id: registration.NodeID })}
        sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
      >
        {registration.NodeID.substring(0, 8)}
      </Link>
      <Link
        component={RouterLink}
        to={createRouteURL('nomadJob', { name: registration.JobID, namespace: registration.Namespace })}
        sx={{ fontSize: '0.75rem' }}
      >
        {registration.JobID}
      </Link>
      <Link
        component={RouterLink}
        to={createRouteURL('nomadAllocation', { id: registration.AllocID })}
        sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
      >
        {registration.AllocID.substring(0, 8)}
      </Link>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {registration.Tags && registration.Tags.length > 0 ? (
          <>
            {registration.Tags.slice(0, 2).map((tag, idx) => (
              <Chip key={idx} label={tag} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
            ))}
            {registration.Tags.length > 2 && (
              <Tooltip title={registration.Tags.slice(2).join(', ')}>
                <Chip size="small" label={`+${registration.Tags.length - 2}`} sx={{ fontSize: '0.6rem', height: 18 }} />
              </Tooltip>
            )}
          </>
        ) : (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
        )}
      </Box>
    </Box>
  );
}

export default function ServiceDetails() {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const { namespace } = useNamespace();
  const [registrations, setRegistrations] = useState<ServiceRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [viewMode, , toggleViewMode] = useViewPreference();

  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;
  const namespaceHint = searchParams.get('ns');

  const loadData = useCallback(async () => {
    if (!name) return;

    try {
      setLoading(true);
      let data: ServiceRegistration[];
      
      if (namespaceHint) {
        data = await getService(name, namespaceHint);
      } else if (namespace !== ALL_NAMESPACES) {
        data = await getService(name, namespace);
      } else {
        data = await getServiceAllNamespaces(name);
      }
      
      setRegistrations(data || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [name, namespace, namespaceHint]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <Box>
        <BackLink />
        <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1, mb: 2 }} />
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  if (error) {
    return <ErrorPage message="Error loading service" error={error} />;
  }

  const uniqueDatacenters = [...new Set(registrations.map(r => r.Datacenter))];
  const uniqueNodes = [...new Set(registrations.map(r => r.NodeID))];
  const uniqueJobs = [...new Set(registrations.map(r => r.JobID))];
  const allTags = [...new Set(registrations.flatMap(r => r.Tags || []))];
  const firstReg = registrations[0];

  return (
    <Box sx={{ pb: 3 }}>
      <BackLink />

      {/* Compact Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 2,
          pb: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
              {name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: registrations.length > 0 ? colors.success : colors.cancelled }} />
              <Typography variant="caption" sx={{ color: registrations.length > 0 ? colors.success : 'text.disabled', fontWeight: 500, fontSize: '0.75rem' }}>
                {registrations.length} instance{registrations.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            {firstReg && (
              <>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Icon icon="mdi:folder-outline" width={14} />
                  {firstReg.Namespace}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Icon icon="mdi:map-marker" width={14} />
                  {uniqueDatacenters.join(', ')}
                </Typography>
              </>
            )}
            {allTags.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {allTags.slice(0, 4).map((tag, idx) => (
                  <Chip key={idx} label={tag} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 18 }} />
                ))}
                {allTags.length > 4 && (
                  <Chip size="small" label={`+${allTags.length - 4}`} sx={{ fontSize: '0.65rem', height: 18 }} />
                )}
              </Box>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <NamespaceSwitcher />
          <Tooltip title={viewMode === 'grid' ? 'Table view' : 'Card view'}>
            <IconButton onClick={toggleViewMode} size="small" sx={{ p: 0.75 }}>
              <Icon icon={viewMode === 'grid' ? 'mdi:format-list-bulleted' : 'mdi:view-grid'} width={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton onClick={loadData} size="small" sx={{ p: 0.75 }}>
              <Icon icon="mdi:refresh" width={18} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {registrations.length === 0 ? (
        <Paper elevation={0} sx={{ p: 3, textAlign: 'center', borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>No registrations found</Typography>
        </Paper>
      ) : (
        <>
          {/* Compact Stats Bar */}
          <Box
            sx={{
              display: 'flex',
              gap: 4,
              mb: 2,
              pb: 2,
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            <StatItem label="Instances" value={registrations.length} color={colors.success} />
            <StatItem label="Nodes" value={uniqueNodes.length} color={theme.palette.info.main} />
            <StatItem label="Jobs" value={uniqueJobs.length} color={theme.palette.warning.main} />
            <StatItem label="Datacenters" value={uniqueDatacenters.length} color={theme.palette.primary.main} />
          </Box>

          {/* Instances Table */}
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
            Instances
          </Typography>
          <Paper elevation={0} sx={{ borderRadius: 1, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
            {/* Header */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 80px 100px 80px auto',
                gap: 2,
                py: 0.75,
                px: 1.5,
                backgroundColor: alpha(theme.palette.text.primary, 0.02),
                borderBottom: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase' }}>Address</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase' }}>Datacenter</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase' }}>Node</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase' }}>Job</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase' }}>Alloc</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: 'right' }}>Tags</Typography>
            </Box>
            {/* Rows */}
            {registrations.map(reg => (
              <InstanceRow key={reg.ID} registration={reg} />
            ))}
          </Paper>
        </>
      )}
    </Box>
  );
}
