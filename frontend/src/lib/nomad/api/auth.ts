import { get, post } from './requests';

export interface LoginResponse {
  status: string;
}

export interface AuthCheckResponse {
  authenticated: boolean;
}

/**
 * Login to a Nomad cluster with an ACL token
 * The token is stored as an HTTPOnly cookie by the backend
 */
export function login(token: string, cluster?: string): Promise<LoginResponse> {
  return post('/v1/auth/login', { token }, { cluster });
}

/**
 * Logout from a Nomad cluster
 * Clears the HTTPOnly auth cookie
 */
export function logout(cluster?: string): Promise<LoginResponse> {
  return post('/v1/auth/logout', {}, { cluster });
}

/**
 * Check if the user is authenticated to a Nomad cluster
 */
export function checkAuth(cluster?: string): Promise<AuthCheckResponse> {
  return get('/v1/auth/check', undefined, { cluster });
}

export interface ClusterHealthResponse {
  status: 'healthy' | 'auth_required' | 'unreachable' | 'error';
  reachable: boolean;
  authenticated: boolean;
  message?: string;
  leader?: string;
}

/**
 * Check the health of a Nomad cluster
 * This validates connectivity and authentication status
 */
export function checkClusterHealth(cluster: string): Promise<ClusterHealthResponse> {
  return get('/health', undefined, { cluster });
}
