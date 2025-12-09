/**
 * Cluster preferences storage for user customizations.
 * Stores custom colors, emojis, ordering, groups, and recent activity.
 */

const PREFERENCES_KEY = 'caravan_cluster_preferences';
const RECENT_CLUSTERS_KEY = 'caravan_recent_clusters';
const LAST_CLUSTER_KEY = 'caravan_last_cluster';
const CLUSTER_VIEW_STATE_KEY = 'caravan_cluster_view_state';

export interface ClusterPreferences {
  /** Custom color override (hex color) */
  customColor?: string;
  /** Custom emoji/icon */
  emoji?: string;
  /** Group/folder this cluster belongs to */
  group?: string;
  /** Sort order (lower = higher in list) */
  sortOrder?: number;
  /** Custom display name/alias */
  alias?: string;
  /** Last activity timestamp */
  lastActivity?: number;
}

export interface ClusterGroup {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  collapsed?: boolean;
}

export interface ClusterViewState {
  /** Selected sidebar items */
  sidebarState?: Record<string, any>;
  /** Active namespace filter */
  namespaces?: string[];
  /** Any other view preferences */
  [key: string]: any;
}

// ============================================================================
// Cluster Preferences
// ============================================================================

/**
 * Get all cluster preferences
 */
export function getAllClusterPreferences(): Record<string, ClusterPreferences> {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Get preferences for a specific cluster
 */
export function getClusterPreferences(clusterName: string): ClusterPreferences {
  const all = getAllClusterPreferences();
  return all[clusterName] || {};
}

/**
 * Update preferences for a specific cluster
 */
export function updateClusterPreferences(
  clusterName: string,
  updates: Partial<ClusterPreferences>
): void {
  try {
    const all = getAllClusterPreferences();
    all[clusterName] = { ...all[clusterName], ...updates };
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(all));
  } catch (error) {
    console.error('Failed to save cluster preferences:', error);
  }
}

/**
 * Remove preferences for a cluster
 */
export function removeClusterPreferences(clusterName: string): void {
  try {
    const all = getAllClusterPreferences();
    delete all[clusterName];
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(all));
  } catch (error) {
    console.error('Failed to remove cluster preferences:', error);
  }
}

/**
 * Get custom color for a cluster (or undefined to use default)
 */
export function getClusterCustomColor(clusterName: string): string | undefined {
  return getClusterPreferences(clusterName).customColor;
}

/**
 * Set custom color for a cluster
 */
export function setClusterCustomColor(clusterName: string, color: string | undefined): void {
  updateClusterPreferences(clusterName, { customColor: color });
}

/**
 * Get emoji for a cluster
 */
export function getClusterEmoji(clusterName: string): string | undefined {
  return getClusterPreferences(clusterName).emoji;
}

/**
 * Set emoji for a cluster
 */
export function setClusterEmoji(clusterName: string, emoji: string | undefined): void {
  updateClusterPreferences(clusterName, { emoji });
}

/**
 * Get cluster group
 */
export function getClusterGroup(clusterName: string): string | undefined {
  return getClusterPreferences(clusterName).group;
}

/**
 * Set cluster group
 */
export function setClusterGroup(clusterName: string, group: string | undefined): void {
  updateClusterPreferences(clusterName, { group });
}

/**
 * Get cluster sort order
 */
export function getClusterSortOrder(clusterName: string): number {
  return getClusterPreferences(clusterName).sortOrder ?? 999;
}

/**
 * Set cluster sort order
 */
export function setClusterSortOrder(clusterName: string, sortOrder: number): void {
  updateClusterPreferences(clusterName, { sortOrder });
}

/**
 * Bulk update sort orders (for drag & drop)
 */
export function updateClusterSortOrders(orders: Record<string, number>): void {
  try {
    const all = getAllClusterPreferences();
    Object.entries(orders).forEach(([name, order]) => {
      all[name] = { ...all[name], sortOrder: order };
    });
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(all));
  } catch (error) {
    console.error('Failed to update cluster sort orders:', error);
  }
}

// ============================================================================
// Cluster Groups
// ============================================================================

const GROUPS_KEY = 'caravan_cluster_groups';

/**
 * Get all cluster groups
 */
export function getClusterGroups(): ClusterGroup[] {
  try {
    const stored = localStorage.getItem(GROUPS_KEY);
    return stored ? JSON.parse(stored) : getDefaultGroups();
  } catch {
    return getDefaultGroups();
  }
}

/**
 * Get default groups
 */
function getDefaultGroups(): ClusterGroup[] {
  return [
    { id: 'production', name: 'Production', emoji: '🚀', color: '#E91E63' },
    { id: 'staging', name: 'Staging', emoji: '🧪', color: '#FF9800' },
    { id: 'development', name: 'Development', emoji: '💻', color: '#4CAF50' },
  ];
}

/**
 * Save cluster groups
 */
export function saveClusterGroups(groups: ClusterGroup[]): void {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  } catch (error) {
    console.error('Failed to save cluster groups:', error);
  }
}

/**
 * Add a new group
 */
export function addClusterGroup(group: ClusterGroup): void {
  const groups = getClusterGroups();
  groups.push(group);
  saveClusterGroups(groups);
}

/**
 * Update a group
 */
export function updateClusterGroup(groupId: string, updates: Partial<ClusterGroup>): void {
  const groups = getClusterGroups();
  const index = groups.findIndex(g => g.id === groupId);
  if (index !== -1) {
    groups[index] = { ...groups[index], ...updates };
    saveClusterGroups(groups);
  }
}

/**
 * Toggle group collapsed state
 */
export function toggleGroupCollapsed(groupId: string): void {
  const groups = getClusterGroups();
  const group = groups.find(g => g.id === groupId);
  if (group) {
    group.collapsed = !group.collapsed;
    saveClusterGroups(groups);
  }
}

// ============================================================================
// Recent Clusters
// ============================================================================

const MAX_RECENT_CLUSTERS = 5;

/**
 * Get recent clusters (most recent first)
 */
export function getRecentClusters(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_CLUSTERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Add a cluster to recent list
 */
export function addToRecentClusters(clusterName: string): void {
  try {
    let recent = getRecentClusters();
    // Remove if already exists
    recent = recent.filter(c => c !== clusterName);
    // Add to front
    recent.unshift(clusterName);
    // Limit size
    recent = recent.slice(0, MAX_RECENT_CLUSTERS);
    localStorage.setItem(RECENT_CLUSTERS_KEY, JSON.stringify(recent));
    
    // Also update last activity
    updateClusterPreferences(clusterName, { lastActivity: Date.now() });
  } catch (error) {
    console.error('Failed to update recent clusters:', error);
  }
}

/**
 * Clear recent clusters
 */
export function clearRecentClusters(): void {
  localStorage.removeItem(RECENT_CLUSTERS_KEY);
}

// ============================================================================
// Last Cluster (for auto-reconnect)
// ============================================================================

/**
 * Get the last used cluster
 */
export function getLastCluster(): string | null {
  try {
    return localStorage.getItem(LAST_CLUSTER_KEY);
  } catch {
    return null;
  }
}

/**
 * Set the last used cluster
 */
export function setLastCluster(clusterName: string): void {
  try {
    localStorage.setItem(LAST_CLUSTER_KEY, clusterName);
  } catch (error) {
    console.error('Failed to save last cluster:', error);
  }
}

/**
 * Clear last cluster
 */
export function clearLastCluster(): void {
  localStorage.removeItem(LAST_CLUSTER_KEY);
}

// ============================================================================
// Per-Cluster View State
// ============================================================================

/**
 * Get all cluster view states
 */
function getAllClusterViewStates(): Record<string, ClusterViewState> {
  try {
    const stored = localStorage.getItem(CLUSTER_VIEW_STATE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Get view state for a specific cluster
 */
export function getClusterViewState(clusterName: string): ClusterViewState {
  const all = getAllClusterViewStates();
  return all[clusterName] || {};
}

/**
 * Save view state for a specific cluster
 */
export function saveClusterViewState(clusterName: string, state: ClusterViewState): void {
  try {
    const all = getAllClusterViewStates();
    all[clusterName] = state;
    localStorage.setItem(CLUSTER_VIEW_STATE_KEY, JSON.stringify(all));
  } catch (error) {
    console.error('Failed to save cluster view state:', error);
  }
}

/**
 * Update partial view state for a cluster
 */
export function updateClusterViewState(
  clusterName: string,
  updates: Partial<ClusterViewState>
): void {
  const current = getClusterViewState(clusterName);
  saveClusterViewState(clusterName, { ...current, ...updates });
}

/**
 * Clear view state for a cluster
 */
export function clearClusterViewState(clusterName: string): void {
  try {
    const all = getAllClusterViewStates();
    delete all[clusterName];
    localStorage.setItem(CLUSTER_VIEW_STATE_KEY, JSON.stringify(all));
  } catch (error) {
    console.error('Failed to clear cluster view state:', error);
  }
}

// ============================================================================
// Utility: Format relative time
// ============================================================================

/**
 * Format a timestamp as relative time (e.g., "2m ago", "1h ago")
 */
export function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return 'Never';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

// ============================================================================
// Predefined Colors for picker
// ============================================================================

export const CLUSTER_COLORS = [
  '#E91E63', // Pink
  '#9C27B0', // Purple
  '#673AB7', // Deep Purple
  '#3F51B5', // Indigo
  '#2196F3', // Blue
  '#03A9F4', // Light Blue
  '#00BCD4', // Cyan
  '#009688', // Teal
  '#4CAF50', // Green
  '#8BC34A', // Light Green
  '#CDDC39', // Lime
  '#FFC107', // Amber
  '#FF9800', // Orange
  '#FF5722', // Deep Orange
  '#795548', // Brown
  '#607D8B', // Blue Grey
  '#F44336', // Red
];

// ============================================================================
// Predefined Emojis for picker
// ============================================================================

export const CLUSTER_EMOJIS = [
  '🚀', // Production
  '🧪', // Staging/Test
  '💻', // Development
  '🏠', // Local
  '☁️', // Cloud
  '🌍', // Global/Geo
  '🔒', // Secure
  '⚡', // Fast/Performance
  '🎯', // Target/Main
  '🔥', // Hot/Active
  '❄️', // Cold/Archive
  '🌙', // Night/Dark
  '☀️', // Day/Light
  '🏢', // Enterprise
  '🎪', // Demo
  '🛠️', // Tools/Infra
  '📊', // Analytics
  '🎮', // Gaming
  '🤖', // AI/ML
  '💾', // Data/Storage
];

