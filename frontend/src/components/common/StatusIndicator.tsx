import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SxProps, Theme, useTheme } from '@mui/material/styles';

/**
 * Minimal status indicator design principles:
 * - Small colored dot (6px) for status at-a-glance
 * - Plain text label, no backgrounds or borders
 * - Color used sparingly - only the dot carries color
 * - Easy vertical scanning in tables
 */

export type StatusType = 'success' | 'warning' | 'error' | 'pending' | 'neutral';

export interface StatusIndicatorProps {
  /** The status type determining the dot color */
  status: StatusType;
  /** The text label to display */
  label: string;
  /** Optional: hide the dot and show only text with color */
  textOnly?: boolean;
  /** Optional: show a pulsing animation for active states */
  pulse?: boolean;
  /** Custom styles */
  sx?: SxProps<Theme>;
}

/** Get semantic color for status */
function getStatusColor(status: StatusType, theme: Theme): string {
  const colors: Record<StatusType, string> = {
    success: theme.palette.mode === 'dark' ? '#4ade80' : '#16a34a',
    warning: theme.palette.mode === 'dark' ? '#fbbf24' : '#d97706',
    error: theme.palette.mode === 'dark' ? '#f87171' : '#dc2626',
    pending: theme.palette.mode === 'dark' ? '#60a5fa' : '#2563eb',
    neutral: theme.palette.mode === 'dark' ? '#9ca3af' : '#6b7280',
  };
  return colors[status];
}

/** Map common status strings to StatusType */
export function parseStatus(status: string): StatusType {
  const s = status.toLowerCase();

  // Success states
  if (['running', 'ready', 'complete', 'successful', 'healthy', 'active'].includes(s)) {
    return 'success';
  }

  // Error states
  if (['failed', 'dead', 'lost', 'down', 'disconnected', 'error', 'unhealthy', 'ineligible'].includes(s)) {
    return 'error';
  }

  // Warning states
  if (['draining', 'blocked', 'degraded'].includes(s)) {
    return 'warning';
  }

  // Pending/In-progress states
  if (['pending', 'initializing', 'starting', 'queued', 'scheduled'].includes(s)) {
    return 'pending';
  }

  return 'neutral';
}

/**
 * Minimal status indicator with colored dot and plain text
 *
 * Design philosophy:
 * - Reduces visual noise compared to chips/badges
 * - Status is conveyed through subtle color dot
 * - Text remains readable without heavy styling
 * - Works well in dense table layouts
 */
export function StatusIndicator({
  status,
  label,
  textOnly = false,
  pulse = false,
  sx,
}: StatusIndicatorProps) {
  const theme = useTheme();
  const color = getStatusColor(status, theme);

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        ...sx,
      }}
    >
      {!textOnly && (
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: color,
            flexShrink: 0,
            ...(pulse && {
              animation: 'pulse 2s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }),
          }}
        />
      )}
      <Typography
        variant="body2"
        component="span"
        sx={{
          color: textOnly ? color : 'text.primary',
          fontSize: '0.8125rem',
          lineHeight: 1.4,
          fontWeight: textOnly ? 500 : 400,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

/**
 * Compact allocation/resource counter display
 *
 * Shows counts with minimal colored indicators
 * Example: "3 running · 1 pending · 0 failed"
 */
export interface ResourceCounterProps {
  counts: {
    label: string;
    count: number;
    status: StatusType;
  }[];
  /** Only show non-zero counts */
  hideZero?: boolean;
  sx?: SxProps<Theme>;
}

export function ResourceCounter({ counts, hideZero = true, sx }: ResourceCounterProps) {
  const theme = useTheme();
  const visibleCounts = hideZero ? counts.filter(c => c.count > 0) : counts;

  if (visibleCounts.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1.5,
        ...sx,
      }}
    >
      {visibleCounts.map(({ label, count, status }, index) => (
        <Box
          key={label}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <Typography
            variant="body2"
            component="span"
            sx={{
              color: getStatusColor(status, theme),
              fontWeight: 600,
              fontSize: '0.8125rem',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {count}
          </Typography>
          <Typography
            variant="body2"
            component="span"
            sx={{
              color: 'text.secondary',
              fontSize: '0.75rem',
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
 * Simple text-only status with semantic color
 * Even more minimal - just colored text, no dot
 */
export interface StatusTextProps {
  status: string;
  sx?: SxProps<Theme>;
}

export function StatusText({ status, sx }: StatusTextProps) {
  const theme = useTheme();
  const statusType = parseStatus(status);
  const color = getStatusColor(statusType, theme);

  return (
    <Typography
      variant="body2"
      component="span"
      sx={{
        color,
        fontSize: '0.8125rem',
        fontWeight: 500,
        textTransform: 'capitalize',
        ...sx,
      }}
    >
      {status}
    </Typography>
  );
}

export default StatusIndicator;
