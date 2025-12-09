import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SxProps, Theme, useTheme } from '@mui/material/styles';
import { Chip, ChipProps } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CancelIcon from '@mui/icons-material/Cancel';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

// Status categories
export type StatusCategory = 'success' | 'error' | 'warning' | 'pending' | 'cancelled' | 'default';

/**
 * Minimal status colors - semantic colors for text/dots only
 * Follows the principle: color should inform, not decorate
 */
export const minimalStatusColors = {
  light: {
    success: '#16a34a', // green-600
    error: '#dc2626',   // red-600
    warning: '#d97706', // amber-600
    pending: '#2563eb', // blue-600
    cancelled: '#6b7280', // gray-500
    default: '#6b7280',
  },
  dark: {
    success: '#4ade80', // green-400
    error: '#f87171',   // red-400
    warning: '#fbbf24', // amber-400
    pending: '#60a5fa', // blue-400
    cancelled: '#9ca3af', // gray-400
    default: '#9ca3af',
  },
};

// Legacy colors - kept for backward compatibility with StatusChip
export const statusColors = {
  success: {
    background: '#e8f5e9',
    color: '#1b5e20',
    border: '#4caf50',
  },
  error: {
    background: '#ffebee',
    color: '#b71c1c',
    border: '#f44336',
  },
  warning: {
    background: '#fff3e0',
    color: '#e65100',
    border: '#ff9800',
  },
  pending: {
    background: '#e3f2fd',
    color: '#0d47a1',
    border: '#2196f3',
  },
  cancelled: {
    background: '#fafafa',
    color: '#616161',
    border: '#9e9e9e',
  },
  default: {
    background: '#f5f5f5',
    color: '#424242',
    border: '#bdbdbd',
  },
};

// Map status strings to categories
export function getStatusCategory(status: string): StatusCategory {
  const s = status.toLowerCase();

  // Success states
  if (['running', 'ready', 'complete', 'successful', 'healthy'].includes(s)) {
    return 'success';
  }

  // Error states
  if (['failed', 'dead', 'lost', 'down', 'disconnected', 'error', 'unhealthy', 'ineligible'].includes(s)) {
    return 'error';
  }

  // Warning states
  if (['pending', 'initializing', 'starting', 'blocked', 'draining'].includes(s)) {
    return 'warning';
  }

  // Pending/In-progress states
  if (['queued', 'scheduled'].includes(s)) {
    return 'pending';
  }

  // Cancelled states
  if (['canceled', 'cancelled', 'stopped', 'paused'].includes(s)) {
    return 'cancelled';
  }

  return 'default';
}

// Get MUI chip color (for backward compatibility)
export function getStatusColor(status: string): 'success' | 'error' | 'warning' | 'default' {
  const category = getStatusCategory(status);
  switch (category) {
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    case 'warning':
    case 'pending':
      return 'warning';
    default:
      return 'default';
  }
}

// Get icon for status
function getStatusIcon(category: StatusCategory): React.ReactNode {
  switch (category) {
    case 'success':
      return <CheckCircleIcon sx={{ fontSize: 16 }} />;
    case 'error':
      return <ErrorIcon sx={{ fontSize: 16 }} />;
    case 'warning':
      return <WarningIcon sx={{ fontSize: 16 }} />;
    case 'pending':
      return <HourglassEmptyIcon sx={{ fontSize: 16 }} />;
    case 'cancelled':
      return <CancelIcon sx={{ fontSize: 16 }} />;
    default:
      return <HelpOutlineIcon sx={{ fontSize: 16 }} />;
  }
}

interface StatusChipProps extends Omit<ChipProps, 'color'> {
  status: string;
  showIcon?: boolean;
  label?: string;
}

/**
 * A styled status chip with clear visual distinction between states
 */
export function StatusChip({ status, showIcon = true, label, ...props }: StatusChipProps) {
  const category = getStatusCategory(status);
  const colors = statusColors[category];

  return (
    <Chip
      label={label || status}
      size="small"
      icon={showIcon ? getStatusIcon(category) as React.ReactElement : undefined}
      sx={{
        backgroundColor: colors.background,
        color: colors.color,
        border: `1px solid ${colors.border}`,
        fontWeight: 500,
        '& .MuiChip-icon': {
          color: colors.color,
        },
        ...props.sx,
      }}
      {...props}
    />
  );
}

// Node-specific status colors (ready/down are different from job states)
export function getNodeStatusColor(status: string): 'success' | 'error' | 'warning' | 'default' {
  switch (status.toLowerCase()) {
    case 'ready':
      return 'success';
    case 'initializing':
      return 'warning';
    case 'down':
    case 'disconnected':
      return 'error';
    default:
      return 'default';
  }
}

// Allocation-specific status colors
export function getAllocationStatusColor(status: string): 'success' | 'error' | 'warning' | 'default' {
  switch (status.toLowerCase()) {
    case 'running':
      return 'success';
    case 'pending':
    case 'starting':
      return 'warning';
    case 'failed':
    case 'lost':
    case 'dead':
      return 'error';
    default:
      return 'default';
  }
}

// Job-specific status colors
export function getJobStatusColor(status: string): 'success' | 'error' | 'warning' | 'default' {
  switch (status.toLowerCase()) {
    case 'running':
      return 'success';
    case 'pending':
      return 'warning';
    case 'dead':
      return 'error';
    default:
      return 'default';
  }
}

// Evaluation-specific status colors
export function getEvaluationStatusColor(status: string): 'success' | 'error' | 'warning' | 'default' {
  switch (status.toLowerCase()) {
    case 'complete':
      return 'success';
    case 'pending':
    case 'blocked':
      return 'warning';
    case 'failed':
    case 'canceled':
      return 'error';
    default:
      return 'default';
  }
}

// ============================================================================
// MINIMAL STATUS COMPONENTS
// ============================================================================
// These components follow a minimal chrome design philosophy:
// - No backgrounds or borders
// - Small colored dot + plain text
// - Color used sparingly for emphasis
// - Easy vertical scanning in tables

interface MinimalStatusProps {
  status: string;
  label?: string;
  showDot?: boolean;
  sx?: SxProps<Theme>;
}

/**
 * Minimal status indicator with small colored dot
 *
 * Design principles:
 * - 6px dot provides color at-a-glance
 * - Plain text is more readable than decorated chips
 * - Reduces visual noise in dense table layouts
 */
export function MinimalStatus({ status, label, showDot = true, sx }: MinimalStatusProps) {
  const theme = useTheme();
  const category = getStatusCategory(status);
  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;
  const color = colors[category];

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        ...sx,
      }}
    >
      {showDot && (
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: color,
            flexShrink: 0,
          }}
        />
      )}
      <Typography
        variant="body2"
        component="span"
        sx={{
          color: showDot ? 'text.primary' : color,
          fontSize: '0.8125rem',
          lineHeight: 1.4,
          fontWeight: showDot ? 400 : 500,
          textTransform: 'capitalize',
        }}
      >
        {label || status}
      </Typography>
    </Box>
  );
}

/**
 * Compact resource counter for allocation summaries
 * Shows: "3 running · 1 pending" with colored numbers
 */
interface AllocationCountsProps {
  running?: number;
  pending?: number;
  failed?: number;
  complete?: number;
  sx?: SxProps<Theme>;
}

export function AllocationCounts({ running = 0, pending = 0, failed = 0, complete = 0, sx }: AllocationCountsProps) {
  const theme = useTheme();
  const colors = theme.palette.mode === 'dark' ? minimalStatusColors.dark : minimalStatusColors.light;

  const items = [
    { count: running, label: 'running', color: colors.success },
    { count: pending, label: 'pending', color: colors.pending },
    { count: failed, label: 'failed', color: colors.error },
    { count: complete, label: 'complete', color: colors.cancelled },
  ].filter(item => item.count > 0);

  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
        —
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, ...sx }}>
      {items.map(({ count, label, color }) => (
        <Box key={label} sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.375 }}>
          <Typography
            component="span"
            sx={{
              color,
              fontSize: '0.8125rem',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {count}
          </Typography>
          <Typography
            component="span"
            sx={{
              color: 'text.secondary',
              fontSize: '0.6875rem',
            }}
          >
            {label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Simple inline badge for metadata like namespace, type, etc.
 * Minimal styling - just subtle background, no borders
 */
interface InlineBadgeProps {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

export function InlineBadge({ children, sx }: InlineBadgeProps) {
  const theme = useTheme();
  return (
    <Typography
      component="span"
      sx={{
        display: 'inline-block',
        padding: '2px 6px',
        fontSize: '0.75rem',
        lineHeight: 1.4,
        borderRadius: '4px',
        backgroundColor: theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(0, 0, 0, 0.06)',
        color: 'text.secondary',
        fontWeight: 500,
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}
