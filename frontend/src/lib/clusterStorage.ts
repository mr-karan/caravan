/**
 * Local storage utilities for persisting cluster configurations.
 * Since the backend is stateless, we store dynamic clusters in localStorage
 * and re-register them with the backend on page load.
 */

const STORAGE_KEY = 'caravan_clusters';

export interface StoredCluster {
  name: string;
  address: string;
  region?: string;
  namespace?: string;
  token?: string;
  /** Whether ACL is enabled on this cluster. If false, no token is required. */
  aclEnabled?: boolean;
  /** The authentication type used for this cluster: 'token', 'oidc', or 'none' */
  authType?: 'token' | 'oidc' | 'none';
  /** The OIDC method name used for authentication (only relevant when authType is 'oidc') */
  oidcMethod?: string;
}

/**
 * Get all stored clusters from localStorage
 */
export function getStoredClusters(): StoredCluster[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const clusters = JSON.parse(stored);
    return Array.isArray(clusters) ? clusters : [];
  } catch (error) {
    console.error('Failed to parse stored clusters:', error);
    return [];
  }
}

/**
 * Save a cluster to localStorage
 */
export function saveCluster(cluster: StoredCluster): void {
  try {
    const clusters = getStoredClusters();
    // Remove existing cluster with same name if exists
    const filtered = clusters.filter(c => c.name !== cluster.name);
    filtered.push(cluster);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to save cluster:', error);
  }
}

/**
 * Remove a cluster from localStorage
 */
export function removeCluster(name: string): void {
  try {
    const clusters = getStoredClusters();
    const filtered = clusters.filter(c => c.name !== name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove cluster:', error);
  }
}

/**
 * Check if a cluster exists in localStorage
 */
export function hasCluster(name: string): boolean {
  return getStoredClusters().some(c => c.name === name);
}

/**
 * Get a specific cluster from localStorage
 */
export function getCluster(name: string): StoredCluster | undefined {
  return getStoredClusters().find(c => c.name === name);
}

/**
 * Check if a cluster has a token stored OR if ACL is disabled (no token needed)
 */
export function hasClusterToken(name: string): boolean {
  const cluster = getCluster(name);
  // If ACL is explicitly disabled, no token is needed
  if (cluster?.aclEnabled === false) {
    return true;
  }
  return !!(cluster?.token && cluster.token.trim().length > 0);
}

/**
 * Check if ACL is enabled for a cluster (defaults to true if not specified)
 */
export function isAclEnabled(name: string): boolean {
  const cluster = getCluster(name);
  // Default to true (ACL enabled) if not specified
  return cluster?.aclEnabled !== false;
}

/**
 * Save/update a flag indicating the cluster has a valid auth token (stored as HTTPOnly cookie)
 * This is used to track authentication state without storing the actual token in localStorage
 */
export function saveClusterToken(name: string, hasToken: boolean): void {
  const cluster = getCluster(name);
  if (cluster) {
    // Update the cluster with a marker that we have authenticated
    saveCluster({
      ...cluster,
      token: hasToken ? 'authenticated' : undefined,
    });
  } else {
    // If no stored cluster, just save a minimal entry
    saveCluster({
      name,
      address: '', // Will be filled by config
      token: hasToken ? 'authenticated' : undefined,
    });
  }
}

/**
 * Clear the authentication token flag for a cluster
 */
export function clearClusterToken(name: string): void {
  const cluster = getCluster(name);
  if (cluster) {
    saveCluster({
      ...cluster,
      token: undefined,
    });
  }
}

/**
 * Clear all stored clusters
 */
export function clearClusters(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear clusters:', error);
  }
}

/**
 * Re-register all stored clusters with the backend.
 * This is called on app load to restore clusters from localStorage.
 * Returns the list of successfully registered clusters.
 */
export async function restoreClustersToBackend(): Promise<StoredCluster[]> {
  const storedClusters = getStoredClusters();
  const restoredClusters: StoredCluster[] = [];

  for (const cluster of storedClusters) {
    try {
      const response = await fetch('/api/cluster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: cluster.name,
          address: cluster.address,
          region: cluster.region || '',
          namespace: cluster.namespace || '',
          token: cluster.token || '',
        }),
      });

      if (response.ok) {
        restoredClusters.push(cluster);
      } else {
        // If cluster already exists or other non-fatal error, still consider it restored
        const status = response.status;
        if (status !== 500) {
          restoredClusters.push(cluster);
        } else {
          console.warn(`Failed to restore cluster ${cluster.name}:`, await response.text());
        }
      }
    } catch (error) {
      console.error(`Failed to restore cluster ${cluster.name}:`, error);
    }
  }

  return restoredClusters;
}
