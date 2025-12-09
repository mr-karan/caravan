import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Typography,
  Alert,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import KeyIcon from '@mui/icons-material/Key';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonIcon from '@mui/icons-material/Person';
import PublicIcon from '@mui/icons-material/Public';
import { SectionBox, Loader, ErrorPage } from '../../common';
import { getSelfToken } from '../../../lib/nomad/api/acl';
import { ACLToken } from '../../../lib/nomad/types';
import { DateLabel } from '../../common/Label';

export default function TokenDetails() {
  const [token, setToken] = useState<ACLToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSelfToken();
      setToken(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadToken();
  }, [loadToken]);

  if (loading) {
    return <Loader title="Loading token details..." />;
  }

  if (error) {
    // Check if it's an authentication error
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('403') || errorMessage.includes('401') || errorMessage.includes('permission')) {
      return (
        <SectionBox title="ACL Token">
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Not Authenticated
            </Typography>
            <Typography variant="body2">
              You are not currently authenticated with an ACL token, or ACLs may not be enabled on this cluster.
              To view your token details, please log in with a valid ACL token.
            </Typography>
          </Alert>
        </SectionBox>
      );
    }
    return <ErrorPage message="Error loading token details" error={error} />;
  }

  if (!token) {
    return (
      <SectionBox title="ACL Token">
        <Alert severity="info">
          No token information available. ACLs may not be enabled on this cluster.
        </Alert>
      </SectionBox>
    );
  }

  const isManagement = token.Type === 'management';

  return (
    <SectionBox
      title="ACL Token"
      headerProps={{
        actions: [
          <Tooltip key="refresh" title="Refresh">
            <IconButton onClick={loadToken} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>,
        ],
      }}
    >
      <Card sx={{ mb: 2 }}>
        <CardContent>
          {/* Header with icon and type badge */}
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                backgroundColor: isManagement ? 'error.main' : 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isManagement ? (
                <AdminPanelSettingsIcon sx={{ fontSize: 32, color: 'white' }} />
              ) : (
                <PersonIcon sx={{ fontSize: 32, color: 'white' }} />
              )}
            </Box>
            <Box flex={1}>
              <Typography variant="h6" fontWeight="medium">
                {token.Name || 'Unnamed Token'}
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                <Chip
                  label={isManagement ? 'Management' : 'Client'}
                  color={isManagement ? 'error' : 'primary'}
                  size="small"
                />
                {token.Global && (
                  <Chip
                    icon={<PublicIcon />}
                    label="Global"
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Token details grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
            }}
          >
            <DetailItem label="Accessor ID" value={token.AccessorID} mono />
            <DetailItem
              label="Created"
              value={
                token.CreateTime ? (
                  <DateLabel date={new Date(token.CreateTime)} />
                ) : (
                  '-'
                )
              }
            />
            <DetailItem label="Type" value={token.Type} />
            <DetailItem
              label="Expiration"
              value={
                token.ExpirationTime ? (
                  <DateLabel date={new Date(token.ExpirationTime)} />
                ) : (
                  'Never'
                )
              }
            />
          </Box>

          {/* Policies section */}
          {token.Policies && token.Policies.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
                Policies
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {token.Policies.map((policy) => (
                  <Chip
                    key={policy}
                    label={policy}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            </>
          )}

          {/* Roles section */}
          {token.Roles && token.Roles.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
                Roles
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {token.Roles.map((role) => (
                  <Chip
                    key={role.ID || role.Name}
                    label={role.Name || role.ID}
                    size="small"
                    variant="outlined"
                    color="secondary"
                  />
                ))}
              </Box>
            </>
          )}

          {/* Management token info */}
          {isManagement && (
            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="body2">
                This is a management token with full access to all Nomad operations.
                Management tokens should be used carefully and sparingly.
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Security note */}
      <Alert severity="warning" icon={<KeyIcon />}>
        <Typography variant="body2">
          Your token's Secret ID is not displayed for security reasons.
          If you need the Secret ID, please refer to your original token creation output
          or use the Nomad CLI with appropriate permissions.
        </Typography>
      </Alert>
    </SectionBox>
  );
}

interface DetailItemProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

function DetailItem({ label, value, mono }: DetailItemProps) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontFamily: mono ? 'monospace' : 'inherit',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
