import { without } from 'lodash';
import { matchPath } from 'react-router';
import { getBaseUrl } from '../helpers/getBaseUrl';

/**
 * @returns A path prefixed with cluster path, and the given path.
 *
 * The given path does not start with a /, it will be added.
 */
export function getClusterPrefixedPath(path?: string | null) {
  const baseClusterPath = '/c/:cluster';
  if (!path) {
    return baseClusterPath;
  }
  return baseClusterPath + (path[0] === '/' ? '' : '/') + path;
}

/**
 * Encode a cluster name for use in URLs.
 * This handles special characters like spaces.
 */
export function encodeClusterName(name: string): string {
  return encodeURIComponent(name);
}

/**
 * Decode a cluster name from a URL.
 */
export function decodeClusterName(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch {
    // If decoding fails, return the original string
    return encoded;
  }
}

/**
 * Get the currently selected cluster name.
 *
 * If more than one cluster is selected it will return:
 *  - On details pages: the cluster of the currently viewed resource
 *  - On any other page: one of the selected clusters
 *
 * To get all currently selected clusters please use {@link getSelectedClusters}
 *
 * @returns The current cluster name, or null if not in a cluster context.
 */
export function getCluster(urlPath?: string): string | null {
  const clusterString = getClusterPathParam(urlPath);
  if (!clusterString) return null;

  if (clusterString.includes('+')) {
    return decodeClusterName(clusterString.split('+')[0]);
  }
  return decodeClusterName(clusterString);
}

/** Returns cluster URL parameter from the current path or the given path (raw, encoded form) */
export function getClusterPathParam(maybeUrlPath?: string): string | undefined {
  const prefix = getBaseUrl();
  const urlPath = maybeUrlPath ?? window.location.pathname.slice(prefix.length);

  // In React Router v6/v7, we need to use a wildcard pattern to match sub-paths
  // e.g., '/c/:cluster/*' matches '/c/nomad-pri/nodes'
  const clusterURLMatch = matchPath('/c/:cluster/*', urlPath);

  return clusterURLMatch?.params?.cluster;
}

/**
 * Format cluster path URL parameter
 *
 * Cluster parameter contains selected clusters, with the first one being the current one
 * usually used for details pages.
 * Each cluster name is URL-encoded to handle special characters like spaces.
 *
 * @param selectedClusters - list of all selected clusters
 * @param currentCluster - (optional) cluster name of the current cluster
 * @returns formatted and encoded cluster parameter
 */
export const formatClusterPathParam = (selectedClusters: string[], currentCluster?: string) =>
  (currentCluster
    ? // Put current cluster as first
      [currentCluster, ...without(selectedClusters, currentCluster)]
    : selectedClusters
  )
    .map(encodeClusterName)
    .join('+');

/**
 * Gets clusters.
 *
 * @param returnWhenNoClusters return this value when no clusters are found.
 * @returns the cluster group from the URL (decoded).
 */
export function getClusterGroup(returnWhenNoClusters: string[] = []): string[] {
  const clusterFromURL = getCluster();
  return clusterFromURL?.split('+').map(decodeClusterName) || returnWhenNoClusters;
}

/**
 * Get list of selected clusters.
 *
 * @param returnWhenNoClusters return this value when no clusters are found.
 * @param urlPath optional, path string containing cluster parameters.
 * @returns the cluster group from the URL (decoded).
 */
export function getSelectedClusters(
  returnWhenNoClusters: string[] = [],
  urlPath?: string
): string[] {
  const clusterFromURL = getClusterPathParam(urlPath);
  return clusterFromURL?.split('+').map(decodeClusterName) || returnWhenNoClusters;
}
