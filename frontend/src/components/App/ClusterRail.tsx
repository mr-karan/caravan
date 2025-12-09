import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  alpha,
  Badge,
  Box,
  Chip,
  Collapse,
  Divider,
  IconButton,
  keyframes,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Popover,
  Skeleton,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getCluster } from '../../lib/cluster';
import { hasClusterToken } from '../../lib/clusterStorage';
import {
  addToRecentClusters,
  formatRelativeTime,
  getAllClusterPreferences,
  getClusterCustomColor,
  getClusterEmoji,
  getClusterGroup,
  getClusterGroups,
  getClusterPreferences,
  getClusterSortOrder,
  setLastCluster,
  toggleGroupCollapsed,
  updateClusterSortOrders,
  ClusterGroup,
} from '../../lib/clusterPreferences';
import { createRouteURL } from '../../lib/router/createRouteURL';
import { useTypedSelector } from '../../redux/hooks';
import useClusterNotifications from '../../lib/useClusterNotifications';
import ClusterAvatar from '../common/ClusterAvatar';
import ClusterCustomizeDialog from './ClusterCustomizeDialog';

// Width of the cluster rail
export const CLUSTER_RAIL_WIDTH = 68;

// Pulse animation for status changes
const pulseAnimation = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(76, 175, 80, 0); }
  100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
`;

const pulseErrorAnimation = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(244, 67, 54, 0); }
  100% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0); }
`;

export interface ClusterHealth {
  connected: boolean;
  error?: string;
  errorType?: 'auth' | 'connection' | 'unknown';
  latencyMs?: number;
  nodes?: { total: number; ready: number; down: number };
  jobs?: { total: number; running: number; pending: number; dead: number };
  allocations?: { total: number; running: number; pending: number; failed: number };
  issueCount?: number;
}

// Fetch health status with latency for a cluster
async function fetchClusterHealthStatus(clusterName: string): Promise<ClusterHealth> {
  const startTime = performance.now();
  
  try {
    const [nodesRes, jobsRes, allocsRes] = await Promise.all([
      fetch(`/api/clusters/${encodeURIComponent(clusterName)}/v1/nodes`, {
        credentials: 'include',
      }),
      fetch(`/api/clusters/${encodeURIComponent(clusterName)}/v1/jobs`, {
        credentials: 'include',
      }),
      fetch(`/api/clusters/${encodeURIComponent(clusterName)}/v1/allocations`, {
        credentials: 'include',
      }),
    ]);

    const latencyMs = Math.round(performance.now() - startTime);

    // Check for auth errors
    for (const res of [nodesRes, jobsRes, allocsRes]) {
      if (res.status === 401 || res.status === 403) {
        return { connected: false, error: 'Auth required', errorType: 'auth', latencyMs };
      }
      if (res.status === 500 || !res.ok) {
        return { connected: false, error: 'Connection failed', errorType: 'connection', latencyMs };
      }
    }

    const [nodes, jobs, allocs] = await Promise.all([
      nodesRes.json(),
      jobsRes.json(),
      allocsRes.json(),
    ]);

    // Calculate stats
    const nodesData = {
      total: nodes?.length || 0,
      ready: nodes?.filter((n: any) => n.Status === 'ready').length || 0,
      down: nodes?.filter((n: any) => n.Status === 'down').length || 0,
    };

    const jobsData = {
      total: jobs?.length || 0,
      running: jobs?.filter((j: any) => j.Status === 'running').length || 0,
      pending: jobs?.filter((j: any) => j.Status === 'pending').length || 0,
      dead: jobs?.filter((j: any) => j.Status === 'dead').length || 0,
    };

    const allocsData = {
      total: allocs?.length || 0,
      running: allocs?.filter((a: any) => a.ClientStatus === 'running').length || 0,
      pending: allocs?.filter((a: any) => a.ClientStatus === 'pending').length || 0,
      failed: allocs?.filter((a: any) => a.ClientStatus === 'failed').length || 0,
    };

    // Issue count = down nodes + failed allocations
    const issueCount = nodesData.down + allocsData.failed;

    return {
      connected: true,
      latencyMs,
      nodes: nodesData,
      jobs: jobsData,
      allocations: allocsData,
      issueCount,
    };
  } catch {
    const latencyMs = Math.round(performance.now() - startTime);
    return { connected: false, error: 'Connection failed', errorType: 'connection', latencyMs };
  }
}

// Latency indicator component
function LatencyIndicator({ latencyMs }: { latencyMs?: number }) {
  const theme = useTheme();
  
  if (!latencyMs) return null;

  let color = theme.palette.success.main;
  let label = 'Fast';
  
  if (latencyMs > 500) {
    color = theme.palette.error.main;
    label = 'Slow';
  } else if (latencyMs > 200) {
    color = theme.palette.warning.main;
    label = 'OK';
  }

  return (
    <Chip
      size="small"
      label={`${latencyMs}ms`}
      sx={{
        height: 16,
        fontSize: '0.6rem',
        backgroundColor: alpha(color, 0.1),
        color: color,
        '& .MuiChip-label': { px: 0.75 },
      }}
    />
  );
}

// Hover stats popover
function ClusterHoverStats({
  anchorEl,
  open,
  onClose,
  clusterName,
  health,
  lastActivity,
}: {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  clusterName: string;
  health: ClusterHealth | null;
  lastActivity?: number;
}) {
  const theme = useTheme();

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
      transformOrigin={{ vertical: 'center', horizontal: 'left' }}
      sx={{ pointerEvents: 'none' }}
      disableRestoreFocus
      PaperProps={{
        sx: {
          p: 1.5,
          minWidth: 180,
          borderRadius: 2,
          boxShadow: theme.shadows[8],
        },
      }}
    >
      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        {clusterName}
      </Typography>

      {health?.connected ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Icon icon="mdi:server" width={14} />
            <Typography variant="caption">
              {health.nodes?.ready}/{health.nodes?.total} nodes ready
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Icon icon="mdi:briefcase-outline" width={14} />
            <Typography variant="caption">
              {health.jobs?.running} jobs running
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Icon icon="mdi:cube-outline" width={14} />
            <Typography variant="caption">
              {health.allocations?.running} allocations
            </Typography>
          </Box>
          {health.latencyMs !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Icon icon="mdi:timer-outline" width={14} />
              <Typography variant="caption">
                {health.latencyMs}ms latency
              </Typography>
              <LatencyIndicator latencyMs={health.latencyMs} />
            </Box>
          )}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon
            icon={health?.errorType === 'auth' ? 'mdi:key-alert' : 'mdi:cloud-off-outline'}
            width={14}
            color={health?.errorType === 'auth' ? theme.palette.warning.main : theme.palette.error.main}
          />
          <Typography variant="caption" color={health?.errorType === 'auth' ? 'warning.main' : 'error.main'}>
            {health?.errorType === 'auth' ? 'Auth required' : 'Disconnected'}
          </Typography>
        </Box>
      )}

      {lastActivity && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Active {formatRelativeTime(lastActivity)}
        </Typography>
      )}
    </Popover>
  );
}

// Context menu for clusters
interface ContextMenuState {
  mouseX: number;
  mouseY: number;
  clusterName: string;
}

interface ClusterRailItemProps {
  name: string;
  server?: string;
  isActive: boolean;
  health: ClusterHealth | null;
  loading: boolean;
  index: number;
  customColor?: string;
  emoji?: string;
  lastActivity?: number;
  statusChanged?: boolean;
  onClick: () => void;
  onContextMenu: (event: React.MouseEvent, clusterName: string) => void;
  onCustomize: (clusterName: string) => void;
  // Drag and drop
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, name: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent, name: string) => void;
  onDrop?: (e: React.DragEvent, name: string) => void;
  isDragOver?: boolean;
}

function ClusterRailItem({
  name,
  server,
  isActive,
  health,
  loading,
  index,
  customColor,
  emoji,
  lastActivity,
  statusChanged,
  onClick,
  onContextMenu,
  draggable = false,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDrop,
  isDragOver = false,
}: ClusterRailItemProps) {
  const theme = useTheme();
  const [hoverAnchor, setHoverAnchor] = useState<HTMLElement | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const statusColor = useMemo(() => {
    if (loading || !health) return theme.palette.grey[400];
    if (!health.connected) {
      return health.errorType === 'auth'
        ? theme.palette.warning.main
        : theme.palette.error.main;
    }
    return theme.palette.success.main;
  }, [health, loading, theme]);

  const statusTooltip = useMemo(() => {
    if (loading) return 'Checking...';
    if (!health) return 'Unknown';
    if (!health.connected) {
      return health.errorType === 'auth' ? 'Re-authenticate required' : 'Connection failed';
    }
    return 'Connected';
  }, [health, loading]);

  const shortcutHint = index < 9 ? `⌘${index + 1}` : '';

  // Hover handlers for stats popover
  const handleMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoverAnchor(event.currentTarget);
    }, 500);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHoverAnchor(null);
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    onContextMenu(event, name);
  };

  return (
    <>
      <Tooltip
        title={
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {emoji && <span>{emoji}</span>}
              <Typography variant="body2" fontWeight={600}>
                {name}
              </Typography>
            </Box>
            {server && (
              <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }}>
                {(() => {
                  try {
                    return new URL(server).host;
                  } catch {
                    return server;
                  }
                })()}
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: statusColor,
                }}
              />
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {statusTooltip}
              </Typography>
              {health?.latencyMs && (
                <Typography variant="caption" sx={{ opacity: 0.6, ml: 0.5 }}>
                  ({health.latencyMs}ms)
                </Typography>
              )}
            </Box>
            {shortcutHint && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mt: 0.5,
                  opacity: 0.6,
                  fontFamily: 'monospace',
                  fontSize: '0.65rem',
                }}
              >
                {shortcutHint}
              </Typography>
            )}
          </Box>
        }
        placement="right"
        arrow
        enterDelay={300}
      >
        <Box
          draggable={draggable}
          onDragStart={e => onDragStart?.(e, name)}
          onDragOver={e => {
            e.preventDefault();
            onDragOver?.(e);
          }}
          onDragEnter={e => onDragEnter?.(e, name)}
          onDrop={e => onDrop?.(e, name)}
          onClick={onClick}
          onContextMenu={handleContextMenu}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 0.75,
            cursor: draggable ? 'grab' : 'pointer',
            borderRadius: isActive ? 2 : '50%',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isActive ? 'scale(1)' : isDragOver ? 'scale(1.1)' : 'scale(0.92)',
            opacity: isDragOver ? 0.7 : 1,
            '&:hover': {
              transform: 'scale(1)',
              '& .cluster-avatar': {
                borderRadius: isActive ? 2 : 1.5,
              },
            },
            '&:active': {
              cursor: draggable ? 'grabbing' : 'pointer',
            },
            '&::before': {
              content: '""',
              position: 'absolute',
              left: -10,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 4,
              height: isActive ? 36 : isDragOver ? 24 : 0,
              borderRadius: '0 4px 4px 0',
              backgroundColor: customColor || theme.palette.primary.main,
              transition: 'height 0.2s ease',
            },
            '&:hover::before': {
              height: isActive ? 36 : 16,
            },
          }}
        >
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: statusColor,
                  border: `2px solid ${theme.palette.background.paper}`,
                  boxShadow: theme.shadows[1],
                  animation: statusChanged
                    ? health?.connected
                      ? `${pulseAnimation} 1s ease-out`
                      : `${pulseErrorAnimation} 1s ease-out`
                    : 'none',
                }}
              />
            }
          >
            {loading ? (
              <Skeleton
                variant="circular"
                width={42}
                height={42}
                sx={{
                  bgcolor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.08)',
                }}
              />
            ) : emoji ? (
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: isActive ? 2 : '50%',
                  backgroundColor: customColor || alpha(theme.palette.primary.main, 0.15),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? theme.shadows[2] : 'none',
                }}
                className="cluster-avatar"
              >
                {emoji}
              </Box>
            ) : (
              <ClusterAvatar
                name={name}
                size={42}
                sx={{
                  transition: 'border-radius 0.2s ease',
                  borderRadius: isActive ? 2 : '50%',
                  boxShadow: isActive ? theme.shadows[2] : 'none',
                  ...(customColor && { bgcolor: customColor }),
                }}
                className="cluster-avatar"
              />
            )}
          </Badge>
        </Box>
      </Tooltip>

      {/* Hover stats popover */}
      <ClusterHoverStats
        anchorEl={hoverAnchor}
        open={Boolean(hoverAnchor)}
        onClose={() => setHoverAnchor(null)}
        clusterName={name}
        health={health}
        lastActivity={lastActivity}
      />
    </>
  );
}

// Group header component
function GroupHeader({
  group,
  collapsed,
  onToggle,
  clusterCount,
}: {
  group: ClusterGroup;
  collapsed: boolean;
  onToggle: () => void;
  clusterCount: number;
}) {
  const theme = useTheme();

  return (
    <Tooltip title={`${group.name} (${clusterCount})`} placement="right">
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          py: 0.5,
          cursor: 'pointer',
          opacity: 0.7,
          transition: 'opacity 0.2s',
          '&:hover': { opacity: 1 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.25,
            borderRadius: 1,
            backgroundColor: alpha(group.color || theme.palette.primary.main, 0.1),
          }}
        >
          {group.emoji && <span style={{ fontSize: '0.75rem' }}>{group.emoji}</span>}
          <Icon
            icon={collapsed ? 'mdi:chevron-right' : 'mdi:chevron-down'}
            width={14}
            color={group.color}
          />
        </Box>
      </Box>
    </Tooltip>
  );
}

interface ClusterRailProps {
  onAddCluster?: () => void;
}

export default function ClusterRail({ onAddCluster }: ClusterRailProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const clusters = useTypedSelector(state => state.config.clusters) || {};
  const currentCluster = getCluster();

  const [clusterHealth, setClusterHealth] = useState<Record<string, ClusterHealth>>({});
  const [loading, setLoading] = useState(true);
  const [statusChanged, setStatusChanged] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [customizeCluster, setCustomizeCluster] = useState<string | null>(null);
  const [groups, setGroups] = useState<ClusterGroup[]>(getClusterGroups());
  const [preferences, setPreferences] = useState(getAllClusterPreferences());
  
  // Drag and drop state
  const [draggedCluster, setDraggedCluster] = useState<string | null>(null);
  const [dragOverCluster, setDragOverCluster] = useState<string | null>(null);

  const prevHealthRef = useRef<Record<string, ClusterHealth>>({});

  // Build cluster list with preferences
  const clusterList = useMemo(() => {
    return Object.entries(clusters)
      .map(([name, cluster]) => ({
        name,
        server: (cluster as any)?.server || '',
        group: getClusterGroup(name),
        sortOrder: getClusterSortOrder(name),
        customColor: getClusterCustomColor(name),
        emoji: getClusterEmoji(name),
        lastActivity: getClusterPreferences(name).lastActivity,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [clusters, preferences]);

  // Group clusters
  const groupedClusters = useMemo(() => {
    const grouped: Record<string, typeof clusterList> = { ungrouped: [] };
    
    groups.forEach(g => {
      grouped[g.id] = [];
    });

    clusterList.forEach(cluster => {
      const groupId = cluster.group || 'ungrouped';
      if (grouped[groupId]) {
        grouped[groupId].push(cluster);
      } else {
        grouped.ungrouped.push(cluster);
      }
    });

    return grouped;
  }, [clusterList, groups]);

  // Use notifications hook
  const { notifyClusterSwitch } = useClusterNotifications({
    enableToasts: true,
    clusters: clusterList.map(c => c.name),
    statusMap: clusterHealth,
  });

  // Fetch health status for all clusters
  useEffect(() => {
    let mounted = true;

    const loadHealth = async () => {
      if (clusterList.length === 0) {
        setLoading(false);
        return;
      }

      const healthPromises = clusterList.map(async c => {
        const health = await fetchClusterHealthStatus(c.name);
        return { name: c.name, health };
      });

      const results = await Promise.all(healthPromises);

      if (mounted) {
        const healthMap: Record<string, ClusterHealth> = {};
        const changedMap: Record<string, boolean> = {};

        results.forEach(r => {
          healthMap[r.name] = r.health;
          
          // Check if status changed
          const prev = prevHealthRef.current[r.name];
          if (prev && prev.connected !== r.health.connected) {
            changedMap[r.name] = true;
            // Clear the changed flag after animation
            setTimeout(() => {
              setStatusChanged(prev => ({ ...prev, [r.name]: false }));
            }, 1000);
          }
        });

        prevHealthRef.current = healthMap;
        setClusterHealth(healthMap);
        setStatusChanged(prev => ({ ...prev, ...changedMap }));
        setLoading(false);
      }
    };

    loadHealth();
    const interval = setInterval(loadHealth, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [clusterList.map(c => c.name).join(',')]);

  // Handle cluster selection
  const handleClusterSelect = useCallback(
    (clusterName: string) => {
      if (clusterName !== currentCluster) {
        // Track in recent clusters
        addToRecentClusters(clusterName);
        setLastCluster(clusterName);
        
        // Show notification
        notifyClusterSwitch(currentCluster, clusterName);

        if (hasClusterToken(clusterName)) {
          navigate(createRouteURL('nomadCluster', { cluster: clusterName }));
        } else {
          navigate(createRouteURL('login', { cluster: clusterName }));
        }
      }
    },
    [currentCluster, navigate, notifyClusterSwitch]
  );

  // Keyboard shortcuts (Cmd/Ctrl + 1-9)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key, 10) - 1;
        if (index < clusterList.length) {
          e.preventDefault();
          handleClusterSelect(clusterList[index].name);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clusterList, handleClusterSelect]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, clusterName: string) => {
    setDraggedCluster(clusterName);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', clusterName);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, clusterName: string) => {
    e.preventDefault();
    if (draggedCluster && draggedCluster !== clusterName) {
      setDragOverCluster(clusterName);
    }
  }, [draggedCluster]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetClusterName: string) => {
    e.preventDefault();
    
    if (!draggedCluster || draggedCluster === targetClusterName) {
      setDraggedCluster(null);
      setDragOverCluster(null);
      return;
    }

    // Reorder clusters
    const newOrders: Record<string, number> = {};
    const draggedIndex = clusterList.findIndex(c => c.name === draggedCluster);
    const targetIndex = clusterList.findIndex(c => c.name === targetClusterName);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedCluster(null);
      setDragOverCluster(null);
      return;
    }

    // Create new order
    const reordered = [...clusterList];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    // Assign new sort orders
    reordered.forEach((cluster, index) => {
      newOrders[cluster.name] = index;
    });

    // Save and update state
    updateClusterSortOrders(newOrders);
    setPreferences(getAllClusterPreferences());
    setDraggedCluster(null);
    setDragOverCluster(null);
  }, [draggedCluster, clusterList]);

  const handleDragEnd = useCallback(() => {
    setDraggedCluster(null);
    setDragOverCluster(null);
  }, []);

  // Context menu handlers
  const handleContextMenu = (event: React.MouseEvent, clusterName: string) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      clusterName,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleOpenInNewTab = () => {
    if (contextMenu) {
      const url = hasClusterToken(contextMenu.clusterName)
        ? createRouteURL('nomadCluster', { cluster: contextMenu.clusterName })
        : createRouteURL('login', { cluster: contextMenu.clusterName });
      window.open(url, '_blank');
    }
    handleCloseContextMenu();
  };

  const handleCopyUrl = () => {
    if (contextMenu) {
      const cluster = clusters[contextMenu.clusterName];
      if (cluster?.server) {
        navigator.clipboard.writeText(cluster.server);
      }
    }
    handleCloseContextMenu();
  };

  const handleReconnect = () => {
    if (contextMenu) {
      // Force refresh health for this cluster
      fetchClusterHealthStatus(contextMenu.clusterName).then(health => {
        setClusterHealth(prev => ({ ...prev, [contextMenu.clusterName]: health }));
      });
    }
    handleCloseContextMenu();
  };

  const handleCustomize = (clusterName: string) => {
    setCustomizeCluster(clusterName);
    handleCloseContextMenu();
  };

  const handleGoToHome = () => {
    navigate('/clusters');
  };

  const handleAddCluster = () => {
    navigate('/clusters?add=true');
  };

  const handleToggleGroup = (groupId: string) => {
    toggleGroupCollapsed(groupId);
    setGroups(getClusterGroups());
  };

  // Update preferences when customize dialog closes
  const handleCustomizeClose = () => {
    setCustomizeCluster(null);
    setPreferences(getAllClusterPreferences());
  };

  // Don't show rail if no clusters
  if (clusterList.length === 0) {
    return null;
  }

  // Check if we have any groups with clusters
  const hasGroups = groups.some(g => groupedClusters[g.id]?.length > 0);

  return (
    <>
      <Box
        component="nav"
        aria-label="Cluster navigation"
        sx={{
          width: CLUSTER_RAIL_WIDTH,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 1.5,
          backgroundColor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.background.paper, 0.6)
              : alpha(theme.palette.grey[100], 0.8),
          borderRight: `1px solid ${theme.palette.divider}`,
          backdropFilter: 'blur(8px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          '&::-webkit-scrollbar': {
            width: 4,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: alpha(theme.palette.text.primary, 0.1),
            borderRadius: 2,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: alpha(theme.palette.text.primary, 0.2),
          },
        }}
      >
        {/* Home/Clusters button */}
        <Tooltip title="All Clusters" placement="right" arrow>
          <IconButton
            onClick={handleGoToHome}
            sx={{
              mb: 1,
              p: 1,
              borderRadius: 2,
              color: !currentCluster ? theme.palette.primary.main : 'inherit',
              backgroundColor: !currentCluster
                ? alpha(theme.palette.primary.main, 0.1)
                : 'transparent',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.15),
              },
            }}
          >
            <Icon icon="mdi:view-dashboard" width={22} />
          </IconButton>
        </Tooltip>

        <Divider sx={{ width: 32, my: 1 }} />

        {/* Cluster list - grouped or ungrouped */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            alignItems: 'center',
            flex: 1,
            width: '100%',
            px: 0.5,
          }}
        >
          {hasGroups ? (
            // Render grouped clusters
            <>
              {groups.map(group => {
                const groupClusters = groupedClusters[group.id] || [];
                if (groupClusters.length === 0) return null;

                return (
                  <Box key={group.id} sx={{ width: '100%' }}>
                    <GroupHeader
                      group={group}
                      collapsed={group.collapsed || false}
                      onToggle={() => handleToggleGroup(group.id)}
                      clusterCount={groupClusters.length}
                    />
                    <Collapse in={!group.collapsed}>
                      <Box 
                        onDragEnd={handleDragEnd}
                        sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}
                      >
                        {groupClusters.map((cluster, index) => (
                          <ClusterRailItem
                            key={cluster.name}
                            name={cluster.name}
                            server={cluster.server}
                            isActive={cluster.name === currentCluster}
                            health={clusterHealth[cluster.name] || null}
                            loading={loading}
                            index={clusterList.findIndex(c => c.name === cluster.name)}
                            customColor={cluster.customColor || group.color}
                            emoji={cluster.emoji}
                            lastActivity={cluster.lastActivity}
                            statusChanged={statusChanged[cluster.name]}
                            onClick={() => handleClusterSelect(cluster.name)}
                            onContextMenu={handleContextMenu}
                            onCustomize={handleCustomize}
                            draggable={true}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnter={handleDragEnter}
                            onDrop={handleDrop}
                            isDragOver={dragOverCluster === cluster.name}
                          />
                        ))}
                      </Box>
                    </Collapse>
                  </Box>
                );
              })}

              {/* Ungrouped clusters */}
              {groupedClusters.ungrouped.length > 0 && (
                <Box sx={{ width: '100%', mt: 1 }}>
                  <Divider sx={{ width: 32, mx: 'auto', mb: 1 }} />
                  <Box 
                    onDragEnd={handleDragEnd}
                    sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}
                  >
                    {groupedClusters.ungrouped.map((cluster, index) => (
                      <ClusterRailItem
                        key={cluster.name}
                        name={cluster.name}
                        server={cluster.server}
                        isActive={cluster.name === currentCluster}
                        health={clusterHealth[cluster.name] || null}
                        loading={loading}
                        index={clusterList.findIndex(c => c.name === cluster.name)}
                        customColor={cluster.customColor}
                        emoji={cluster.emoji}
                        lastActivity={cluster.lastActivity}
                        statusChanged={statusChanged[cluster.name]}
                        onClick={() => handleClusterSelect(cluster.name)}
                        onContextMenu={handleContextMenu}
                        onCustomize={handleCustomize}
                        draggable={true}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragEnter}
                        onDrop={handleDrop}
                        isDragOver={dragOverCluster === cluster.name}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </>
          ) : (
            // Render flat list with drag and drop
            <Box onDragEnd={handleDragEnd} sx={{ display: 'contents' }}>
              {clusterList.map((cluster, index) => (
                <ClusterRailItem
                  key={cluster.name}
                  name={cluster.name}
                  server={cluster.server}
                  isActive={cluster.name === currentCluster}
                  health={clusterHealth[cluster.name] || null}
                  loading={loading}
                  index={index}
                  customColor={cluster.customColor}
                  emoji={cluster.emoji}
                  lastActivity={cluster.lastActivity}
                  statusChanged={statusChanged[cluster.name]}
                  onClick={() => handleClusterSelect(cluster.name)}
                  onContextMenu={handleContextMenu}
                  onCustomize={handleCustomize}
                  draggable={true}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDrop={handleDrop}
                  isDragOver={dragOverCluster === cluster.name}
                />
              ))}
            </Box>
          )}
        </Box>

        <Divider sx={{ width: 32, my: 1 }} />

        {/* Add cluster button */}
        <Tooltip title="Add Cluster" placement="right" arrow>
          <IconButton
            onClick={onAddCluster || handleAddCluster}
            sx={{
              p: 1,
              borderRadius: 2,
              border: `2px dashed ${alpha(theme.palette.text.primary, 0.2)}`,
              color: alpha(theme.palette.text.primary, 0.5),
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: theme.palette.primary.main,
                color: theme.palette.primary.main,
                backgroundColor: alpha(theme.palette.primary.main, 0.05),
              },
            }}
          >
            <Icon icon="mdi:plus" width={20} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        PaperProps={{
          sx: {
            minWidth: 180,
            borderRadius: 2,
            boxShadow: theme.shadows[8],
          },
        }}
      >
        <MenuItem onClick={handleOpenInNewTab}>
          <ListItemIcon>
            <Icon icon="mdi:open-in-new" width={18} />
          </ListItemIcon>
          <ListItemText primary="Open in new tab" />
        </MenuItem>
        <MenuItem onClick={handleCopyUrl}>
          <ListItemIcon>
            <Icon icon="mdi:content-copy" width={18} />
          </ListItemIcon>
          <ListItemText primary="Copy cluster URL" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleReconnect}>
          <ListItemIcon>
            <Icon icon="mdi:refresh" width={18} />
          </ListItemIcon>
          <ListItemText primary="Reconnect" />
        </MenuItem>
        <MenuItem onClick={() => contextMenu && handleCustomize(contextMenu.clusterName)}>
          <ListItemIcon>
            <Icon icon="mdi:palette" width={18} />
          </ListItemIcon>
          <ListItemText primary="Customize..." />
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleGoToHome}>
          <ListItemIcon>
            <Icon icon="mdi:cog" width={18} />
          </ListItemIcon>
          <ListItemText primary="Manage clusters" />
        </MenuItem>
      </Menu>

      {/* Customize Dialog */}
      {customizeCluster && (
        <ClusterCustomizeDialog
          open={!!customizeCluster}
          clusterName={customizeCluster}
          onClose={handleCustomizeClose}
        />
      )}
    </>
  );
}
