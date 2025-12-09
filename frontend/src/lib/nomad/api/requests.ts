import { getAppUrl } from '../../../helpers/getAppUrl';
import { getCluster } from '../../cluster';

const DEFAULT_TIMEOUT = 120000; // 2 minutes
const API_PREFIX = 'api';
const CLUSTERS_PREFIX = `${API_PREFIX}/clusters`;

export interface RequestParams extends RequestInit {
  timeout?: number;
  isJSON?: boolean;
  cluster?: string | null;
}

export interface NomadError extends Error {
  status?: number;
  cluster?: string;
  errorType?: 'auth' | 'not_found' | 'connection' | 'unknown';
}

// Error event for components to react to
export type ClusterErrorCallback = (cluster: string, error: NomadError) => void;
const clusterErrorListeners: Set<ClusterErrorCallback> = new Set();

/**
 * Subscribe to cluster errors (auth, not found, connection)
 */
export function onClusterError(callback: ClusterErrorCallback): () => void {
  clusterErrorListeners.add(callback);
  return () => clusterErrorListeners.delete(callback);
}

/**
 * Notify listeners about a cluster error
 */
function notifyClusterError(cluster: string, error: NomadError) {
  clusterErrorListeners.forEach(callback => callback(cluster, error));
}

/**
 * Check if an error is an authentication error
 */
export function isAuthError(error: any): boolean {
  // Check status code first
  if (error?.status === 401 || error?.status === 403) {
    return true;
  }
  // Also check error message for Nomad's permission denied errors
  // These may come through as 500 from our proxy but contain the original error message
  const message = error?.message?.toLowerCase() || '';
  return message.includes('403') ||
         message.includes('permission denied') ||
         message.includes('401') ||
         message.includes('unauthorized');
}

/**
 * Check if an error is a "context not found" error (cluster not registered)
 */
export function isContextNotFoundError(error: any): boolean {
  return (
    error?.status === 500 &&
    (error?.message?.includes('context not found') ||
      error?.message?.includes('not found'))
  );
}

/**
 * Build query string from object
 */
function buildQueryString(params?: Record<string, any>): string {
  if (!params) return '';
  const queryParts = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  return queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
}

/**
 * Make a request to the Nomad API through the backend proxy
 */
export async function nomadRequest<T = any>(
  path: string,
  params: RequestParams = {},
  queryParams?: Record<string, any>
): Promise<T> {
  const {
    timeout = DEFAULT_TIMEOUT,
    cluster: paramsCluster,
    isJSON = true,
    ...otherParams
  } = params;

  const cluster = paramsCluster || getCluster();
  
  // If no cluster is available, throw an error - we can't make API requests without a cluster context
  if (!cluster) {
    const error = new Error('No cluster context available. Please select a cluster first.') as NomadError;
    error.status = 0;
    error.errorType = 'not_found';
    error.cluster = 'unknown';
    notifyClusterError('unknown', error);
    throw error;
  }
  
  const fullPath = `${CLUSTERS_PREFIX}/${cluster}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // getAppUrl() returns URL with trailing slash, so don't add another
  let url = `${getAppUrl()}${fullPath}${buildQueryString(queryParams)}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(otherParams.headers as Record<string, string>),
  };

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers,
      credentials: 'include', // Include HTTPOnly cookies
      ...otherParams,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = new Error(response.statusText) as NomadError;
      error.status = response.status;
      error.cluster = cluster;
      try {
        const json = await response.json();
        error.message = json.error || json.message || response.statusText;
      } catch {
        // Ignore JSON parse errors
      }

      // Determine error type and notify listeners
      if (isAuthError(error)) {
        error.errorType = 'auth';
        notifyClusterError(cluster, error);
      } else if (isContextNotFoundError(error)) {
        error.errorType = 'not_found';
        notifyClusterError(cluster, error);
      } else if (response.status >= 500) {
        error.errorType = 'connection';
        notifyClusterError(cluster, error);
      } else {
        error.errorType = 'unknown';
      }

      throw error;
    }

    if (!isJSON) {
      return response as unknown as T;
    }

    return response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    
    // If it's already a NomadError with errorType, just re-throw
    if ((err as NomadError).errorType) {
      throw err;
    }
    
    if (err instanceof Error) {
      const error = err as NomadError;
      error.cluster = cluster;
      
      if (err.name === 'AbortError') {
        error.message = 'Request timed out';
        error.status = 408;
        error.errorType = 'connection';
        notifyClusterError(cluster, error);
        throw error;
      }
      
      // Handle network errors (DNS failures, connection refused, etc.)
      if (
        err.name === 'TypeError' || // fetch throws TypeError for network errors
        err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('no such host') ||
        err.message.includes('dial tcp') ||
        err.message.includes('Bad Gateway') ||
        err.message.includes('Service Unavailable')
      ) {
        error.errorType = 'connection';
        error.status = 0; // Network error, no HTTP status
        notifyClusterError(cluster, error);
        throw error;
      }
    }
    
    throw err;
  }
}

/**
 * HTTP GET request
 */
export function get<T = any>(
  path: string,
  queryParams?: Record<string, any>,
  options: RequestParams = {}
): Promise<T> {
  return nomadRequest<T>(path, { method: 'GET', ...options }, queryParams);
}

/**
 * HTTP POST request
 */
export function post<T = any>(
  path: string,
  body?: any,
  options: RequestParams = {}
): Promise<T> {
  return nomadRequest<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });
}

/**
 * HTTP PUT request
 */
export function put<T = any>(
  path: string,
  body?: any,
  options: RequestParams = {}
): Promise<T> {
  return nomadRequest<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });
}

/**
 * HTTP DELETE request
 */
export function remove<T = any>(
  path: string,
  queryParams?: Record<string, any>,
  options: RequestParams = {}
): Promise<T> {
  return nomadRequest<T>(path, { method: 'DELETE', ...options }, queryParams);
}
