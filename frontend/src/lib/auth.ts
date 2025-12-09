import * as nomadAuth from './nomad/api/auth';
import { queryClient } from './queryClient';

/**
 * Login to a Nomad cluster with an ACL token.
 * The token is stored as an HTTPOnly cookie by the backend.
 *
 * @param cluster - The name of the cluster.
 * @param token - The Nomad ACL token.
 */
export async function login(cluster: string, token: string): Promise<void> {
  await nomadAuth.login(token, cluster);
  // Invalidate any cached auth-related queries
  queryClient.invalidateQueries({ queryKey: ['auth', cluster], exact: false });
}

/**
 * Logout from a Nomad cluster.
 * Clears the HTTPOnly auth cookie.
 *
 * @param cluster - The name of the cluster to log out from.
 */
export async function logout(cluster: string): Promise<void> {
  await nomadAuth.logout(cluster);
  // Clear any cached auth-related queries
  queryClient.removeQueries({ queryKey: ['auth', cluster], exact: false });
}

/**
 * Check if the user is authenticated to a Nomad cluster.
 *
 * @param cluster - The name of the cluster.
 * @returns True if authenticated, false otherwise.
 */
export async function isAuthenticated(cluster: string): Promise<boolean> {
  try {
    const result = await nomadAuth.checkAuth(cluster);
    return result.authenticated;
  } catch {
    return false;
  }
}

/**
 * Deletes all stored authentication tokens for all clusters.
 * Note: With HTTPOnly cookies, we need to call logout for each cluster.
 */
export async function deleteTokens(clusters: string[]): Promise<void> {
  await Promise.all(clusters.map(cluster => logout(cluster)));
}
