import React, { useEffect, useState } from 'react';
import { alpha, Box, keyframes, Typography, useTheme } from '@mui/material';
import ClusterAvatar from '../common/ClusterAvatar';
import { getClusterCustomColor, getClusterEmoji } from '../../lib/clusterPreferences';

// Animations
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

const scaleIn = keyframes`
  from { 
    opacity: 0;
    transform: scale(0.8);
  }
  to { 
    opacity: 1;
    transform: scale(1);
  }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

interface ClusterSwitchTransitionProps {
  /** The cluster being switched to */
  targetCluster: string | null;
  /** Duration of the transition in ms */
  duration?: number;
  /** Callback when transition completes */
  onComplete?: () => void;
}

/**
 * Full-screen transition overlay shown when switching clusters.
 * Provides visual feedback and a brief loading state.
 */
export default function ClusterSwitchTransition({
  targetCluster,
  duration = 600,
  onComplete,
}: ClusterSwitchTransitionProps) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (targetCluster) {
      setVisible(true);
      setExiting(false);

      // Start exit animation
      const exitTimer = setTimeout(() => {
        setExiting(true);
      }, duration - 200);

      // Complete transition
      const completeTimer = setTimeout(() => {
        setVisible(false);
        setExiting(false);
        onComplete?.();
      }, duration);

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [targetCluster, duration, onComplete]);

  if (!visible || !targetCluster) {
    return null;
  }

  const customColor = getClusterCustomColor(targetCluster);
  const emoji = getClusterEmoji(targetCluster);
  const bgColor = customColor || theme.palette.primary.main;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        backgroundColor: alpha(theme.palette.background.default, 0.95),
        backdropFilter: 'blur(8px)',
        animation: exiting
          ? `${fadeOut} 200ms ease-out forwards`
          : `${fadeIn} 150ms ease-out forwards`,
      }}
    >
      {/* Radial glow effect */}
      <Box
        sx={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(bgColor, 0.2)} 0%, transparent 70%)`,
          animation: `${pulse} 1s ease-in-out infinite`,
        }}
      />

      {/* Cluster avatar/emoji */}
      <Box
        sx={{
          animation: `${scaleIn} 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
        }}
      >
        {emoji ? (
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: 3,
              backgroundColor: alpha(bgColor, 0.15),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              boxShadow: theme.shadows[4],
            }}
          >
            {emoji}
          </Box>
        ) : (
          <ClusterAvatar
            name={targetCluster}
            size={80}
            sx={{
              borderRadius: 3,
              boxShadow: theme.shadows[4],
              ...(customColor && { bgcolor: customColor }),
            }}
          />
        )}
      </Box>

      {/* Cluster name */}
      <Box
        sx={{
          animation: `${scaleIn} 300ms cubic-bezier(0.34, 1.56, 0.64, 1) 100ms forwards`,
          opacity: 0,
        }}
      >
        <Typography
          variant="h5"
          fontWeight={600}
          sx={{
            color: theme.palette.text.primary,
          }}
        >
          {targetCluster}
        </Typography>
      </Box>

      {/* Loading indicator */}
      <Box
        sx={{
          animation: `${scaleIn} 300ms ease-out 200ms forwards`,
          opacity: 0,
        }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <Box
            component="span"
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: bgColor,
              animation: `${pulse} 0.6s ease-in-out infinite`,
            }}
          />
          Connecting...
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Hook to manage cluster switch transitions
 */
export function useClusterSwitchTransition() {
  const [targetCluster, setTargetCluster] = useState<string | null>(null);

  const triggerTransition = (clusterName: string) => {
    setTargetCluster(clusterName);
  };

  const clearTransition = () => {
    setTargetCluster(null);
  };

  return {
    targetCluster,
    triggerTransition,
    clearTransition,
    TransitionOverlay: () => (
      <ClusterSwitchTransition
        targetCluster={targetCluster}
        onComplete={clearTransition}
      />
    ),
  };
}

