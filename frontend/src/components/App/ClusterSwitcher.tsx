import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  alpha,
  Box,
  Button,
  Chip,
  Divider,
  Fade,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getCluster } from '../../lib/cluster';
import { hasClusterToken } from '../../lib/clusterStorage';
import { createRouteURL } from '../../lib/router/createRouteURL';
import { useTypedSelector } from '../../redux/hooks';
import ClusterAvatar from '../common/ClusterAvatar';

/**
 * ClusterSwitcher - A polished dropdown component for quick cluster switching
 *
 * Features:
 * - Shows current cluster with prominent visual indicator
 * - Searchable dropdown list of all configured clusters
 * - Keyboard shortcuts display (⌘1-9)
 * - Quick navigation to any cluster
 * - Link to Home for cluster management
 * - Works with ClusterRail for larger screens
 */
export default function ClusterSwitcher() {
  const theme = useTheme();
  const navigate = useNavigate();
  const clusters = useTypedSelector(state => state.config.clusters) || {};
  const currentCluster = getCluster();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const open = Boolean(anchorEl);
  const isSmallScreen = useMediaQuery('(max-width:600px)');

  const clusterList = Object.entries(clusters).sort(([a], [b]) => a.localeCompare(b));
  const hasMultipleClusters = clusterList.length > 1;

  // Filter clusters based on search
  const filteredClusters = clusterList.filter(([name, cluster]) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const server = (cluster as any)?.server || '';
    return name.toLowerCase().includes(query) || server.toLowerCase().includes(query);
  });

  // Reset search when menu closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
    }
  }, [open]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleClusterSelect = useCallback(
    (clusterName: string) => {
      handleClose();
      if (clusterName !== currentCluster) {
        if (hasClusterToken(clusterName)) {
          navigate(createRouteURL('nomadCluster', { cluster: clusterName }));
        } else {
          navigate(createRouteURL('login', { cluster: clusterName }));
        }
      }
    },
    [currentCluster, navigate]
  );

  const handleGoToHome = () => {
    handleClose();
    navigate('/clusters');
  };

  // Handle keyboard navigation in the menu
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key >= '1' && e.key <= '9' && (e.metaKey || e.ctrlKey)) {
      const index = parseInt(e.key, 10) - 1;
      if (index < clusterList.length) {
        e.preventDefault();
        handleClusterSelect(clusterList[index][0]);
      }
    }
  };

  // Don't show switcher if there are no clusters configured
  if (clusterList.length === 0) {
    return null;
  }

  const currentClusterInfo = currentCluster ? clusters[currentCluster] : null;
  const hasCurrentCluster = !!currentCluster;

  return (
    <>
      <Button
        onClick={handleClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderRadius: 1.5,
          textTransform: 'none',
          color: 'inherit',
          backgroundColor:
            theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(0, 0, 0, 0.04)',
          border: `1px solid ${theme.palette.divider}`,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            backgroundColor:
              theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.12)'
                : 'rgba(0, 0, 0, 0.08)',
            borderColor: alpha(theme.palette.primary.main, 0.3),
            transform: 'translateY(-1px)',
          },
          minWidth: 'auto',
        }}
        aria-label="Switch cluster"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {hasCurrentCluster ? (
          <>
            <ClusterAvatar
              name={currentCluster}
              size={24}
              sx={{
                transition: 'transform 0.2s ease',
                transform: open ? 'scale(1.1)' : 'scale(1)',
              }}
            />
            <Box sx={{ textAlign: 'left', maxWidth: 150 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentCluster}
              </Typography>
              {currentClusterInfo?.server && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.6875rem',
                    lineHeight: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block',
                  }}
                >
                  {(() => {
                    try {
                      return new URL(currentClusterInfo.server).host;
                    } catch {
                      return currentClusterInfo.server;
                    }
                  })()}
                </Typography>
              )}
            </Box>
          </>
        ) : (
          <>
            <Icon icon="mdi:server-network" width={20} />
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                fontSize: '0.8125rem',
              }}
            >
              Select Cluster
            </Typography>
          </>
        )}
        <Icon
          icon={open ? 'mdi:chevron-up' : 'mdi:unfold-more-horizontal'}
          width={16}
          style={{
            opacity: 0.7,
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onKeyDown={handleKeyDown}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        TransitionComponent={Fade}
        transitionDuration={200}
        PaperProps={{
          sx: {
            minWidth: 280,
            maxWidth: 360,
            maxHeight: 480,
            mt: 0.5,
            borderRadius: 2,
            boxShadow: theme.shadows[8],
            border: `1px solid ${theme.palette.divider}`,
            overflow: 'hidden',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            backgroundColor: alpha(theme.palette.primary.main, 0.04),
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, letterSpacing: '0.5px' }}
          >
            SWITCH CLUSTER
          </Typography>
          {hasMultipleClusters && !isSmallScreen && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                opacity: 0.7,
                mt: 0.25,
                fontFamily: 'monospace',
                fontSize: '0.65rem',
              }}
            >
              Use ⌘1-9 for quick switch
            </Typography>
          )}
        </Box>

        {/* Search (only show for 5+ clusters) */}
        {clusterList.length >= 5 && (
          <Box sx={{ px: 1.5, py: 1 }}>
            <TextField
              size="small"
              placeholder="Search clusters..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon icon="mdi:magnify" width={18} />
                  </InputAdornment>
                ),
                sx: { fontSize: '0.875rem' },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                },
              }}
            />
          </Box>
        )}

        {/* Cluster List */}
        <Box sx={{ maxHeight: 320, overflowY: 'auto', py: 0.5 }}>
          {filteredClusters.length === 0 ? (
            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No clusters match "{searchQuery}"
              </Typography>
            </Box>
          ) : (
            filteredClusters.map(([name, cluster], index) => {
              const isCurrentCluster = name === currentCluster;
              const clusterIndex = clusterList.findIndex(([n]) => n === name);
              const shortcut = clusterIndex < 9 ? `⌘${clusterIndex + 1}` : null;

              return (
                <MenuItem
                  key={name}
                  onClick={() => handleClusterSelect(name)}
                  selected={isCurrentCluster}
                  sx={{
                    py: 1.25,
                    px: 2,
                    gap: 1.5,
                    borderRadius: 1,
                    mx: 0.5,
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    },
                    '&.Mui-selected': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.12),
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.16),
                      },
                    },
                  }}
                >
                  <Box sx={{ position: 'relative' }}>
                    <ClusterAvatar name={name} size={32} />
                    {isCurrentCluster && (
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: -2,
                          right: -2,
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: theme.palette.success.main,
                          border: `2px solid ${theme.palette.background.paper}`,
                        }}
                      />
                    )}
                  </Box>
                  <ListItemText
                    primary={name}
                    secondary={
                      (cluster as any)?.server
                        ? (() => {
                            try {
                              return new URL((cluster as any).server).host;
                            } catch {
                              return (cluster as any).server;
                            }
                          })()
                        : undefined
                    }
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: isCurrentCluster ? 600 : 500,
                      sx: {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      },
                    }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                      sx: {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontFamily: 'monospace',
                        fontSize: '0.65rem',
                      },
                    }}
                  />
                  {shortcut && !isSmallScreen && (
                    <Chip
                      label={shortcut}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.625rem',
                        fontFamily: 'monospace',
                        backgroundColor: alpha(theme.palette.text.primary, 0.06),
                      }}
                    />
                  )}
                  {isCurrentCluster && (
                    <Icon icon="mdi:check" width={18} color={theme.palette.primary.main} />
                  )}
                </MenuItem>
              );
            })
          )}
        </Box>

        <Divider />

        {/* Footer Actions */}
        <MenuItem
          onClick={handleGoToHome}
          sx={{
            py: 1.25,
            px: 2,
            gap: 1.5,
            borderRadius: 1,
            mx: 0.5,
            my: 0.5,
          }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <Icon icon="mdi:view-dashboard-outline" width={20} />
          </ListItemIcon>
          <ListItemText
            primary="Manage Clusters"
            primaryTypographyProps={{
              variant: 'body2',
              fontWeight: 500,
            }}
          />
        </MenuItem>
      </Menu>
    </>
  );
}
