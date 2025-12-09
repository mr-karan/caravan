import Avatar from '@mui/material/Avatar';
import { SxProps, Theme } from '@mui/material/styles';
import React from 'react';

interface ClusterAvatarProps {
  name: string;
  size?: number;
  sx?: SxProps<Theme>;
  className?: string;
}

/**
 * Generate a consistent color based on a string
 * Uses a simple hash function to map names to colors
 */
function stringToColor(str: string): string {
  // Vibrant color palette suitable for avatars
  const colors = [
    '#E91E63', // Pink
    '#9C27B0', // Purple
    '#673AB7', // Deep Purple
    '#3F51B5', // Indigo
    '#2196F3', // Blue
    '#00BCD4', // Cyan
    '#009688', // Teal
    '#4CAF50', // Green
    '#8BC34A', // Light Green
    '#FF9800', // Orange
    '#FF5722', // Deep Orange
    '#795548', // Brown
    '#607D8B', // Blue Grey
    '#F44336', // Red
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Get initials from a cluster name
 * Examples:
 * - "production" -> "PR"
 * - "dev-cluster" -> "DC"
 * - "my-nomad-prod" -> "MP"
 * - "a" -> "A"
 */
function getInitials(name: string): string {
  if (!name) return '??';

  // Split by common separators
  const parts = name.split(/[-_.\s]+/).filter(Boolean);

  if (parts.length >= 2) {
    // Take first letter of first and last parts
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  if (parts.length === 1) {
    const word = parts[0];
    if (word.length >= 2) {
      // Take first two characters
      return word.substring(0, 2).toUpperCase();
    }
    return word.toUpperCase();
  }

  return name.substring(0, 2).toUpperCase();
}

/**
 * A consistent avatar component for clusters
 * Generates a unique color and initials based on the cluster name
 */
export default function ClusterAvatar({ name, size = 40, sx, className }: ClusterAvatarProps) {
  const color = stringToColor(name);
  const initials = getInitials(name);

  return (
    <Avatar
      className={className}
      sx={{
        bgcolor: color,
        width: size,
        height: size,
        fontSize: size * 0.4,
        fontWeight: 600,
        ...sx,
      }}
    >
      {initials}
    </Avatar>
  );
}
