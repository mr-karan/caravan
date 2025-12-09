import { getAppUrl } from '../../../helpers/getAppUrl';

/**
 * OIDC Authentication API
 * 
 * This module handles OIDC-based authentication for Nomad clusters.
 * Unlike other API modules, these requests are made without existing auth
 * since they are part of the login flow.
 */

export interface AuthMethod {
  name: string;
  type: string;
  default: boolean;
}

export interface OIDCAuthURLRequest {
  auth_method_name: string;
  redirect_uri: string;
  client_nonce: string;
}

export interface OIDCAuthURLResponse {
  auth_url: string;
}

export interface OIDCCompleteAuthRequest {
  auth_method_name: string;
  client_nonce: string;
  state: string;
  code: string;
  redirect_uri: string;
}

export interface OIDCCompleteAuthResponse {
  accessor_id: string;
  secret_id: string;
  name: string;
  type: string;
  policies: string[];
  global: boolean;
  create_time?: string;
  expiry_time?: string;
}

/**
 * Generate a random nonce for OIDC authentication
 */
export function generateNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Make a request to OIDC endpoints (no auth required)
 */
async function oidcRequest<T>(
  cluster: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getAppUrl()}api/clusters/${encodeURIComponent(cluster)}${path}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const json = await response.json();
      errorMessage = json.error || json.message || errorMessage;
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * List available auth methods for a cluster
 */
export async function listAuthMethods(cluster: string): Promise<AuthMethod[]> {
  return oidcRequest<AuthMethod[]>(cluster, '/v1/acl/auth-methods');
}

/**
 * Get OIDC auth methods only (filter out non-OIDC methods)
 */
export async function listOIDCAuthMethods(cluster: string): Promise<AuthMethod[]> {
  const methods = await listAuthMethods(cluster);
  return methods.filter(m => m.type === 'OIDC');
}

/**
 * Get the OIDC authentication URL from Nomad
 * This is the URL to redirect the user to for authentication
 */
export async function getOIDCAuthURL(
  cluster: string,
  authMethodName: string,
  redirectUri: string,
  clientNonce: string
): Promise<OIDCAuthURLResponse> {
  const body: OIDCAuthURLRequest = {
    auth_method_name: authMethodName,
    redirect_uri: redirectUri,
    client_nonce: clientNonce,
  };

  return oidcRequest<OIDCAuthURLResponse>(cluster, '/v1/acl/oidc/auth-url', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Complete OIDC authentication by exchanging the callback code for a Nomad token
 */
export async function completeOIDCAuth(
  cluster: string,
  authMethodName: string,
  clientNonce: string,
  state: string,
  code: string,
  redirectUri: string
): Promise<OIDCCompleteAuthResponse> {
  const body: OIDCCompleteAuthRequest = {
    auth_method_name: authMethodName,
    client_nonce: clientNonce,
    state,
    code,
    redirect_uri: redirectUri,
  };

  return oidcRequest<OIDCCompleteAuthResponse>(cluster, '/v1/acl/oidc/complete-auth', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Store OIDC state in sessionStorage for the callback to retrieve
 */
export interface OIDCPendingAuth {
  cluster: string;
  authMethod: string;
  nonce: string;
  redirectUri: string;
  returnTo?: string; // URL to return to after auth
}

const OIDC_PENDING_AUTH_KEY = 'caravan_oidc_pending_auth';

export function storeOIDCPendingAuth(auth: OIDCPendingAuth): void {
  sessionStorage.setItem(OIDC_PENDING_AUTH_KEY, JSON.stringify(auth));
}

export function getOIDCPendingAuth(): OIDCPendingAuth | null {
  const stored = sessionStorage.getItem(OIDC_PENDING_AUTH_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearOIDCPendingAuth(): void {
  sessionStorage.removeItem(OIDC_PENDING_AUTH_KEY);
}

/**
 * Start the OIDC login flow
 * Opens a popup window to the OIDC provider
 */
export async function startOIDCLogin(
  cluster: string,
  authMethod: string,
  returnTo?: string
): Promise<Window | null> {
  // Generate nonce
  const nonce = generateNonce();
  
  // Build redirect URI - use current origin + our callback path
  const redirectUri = `${window.location.origin}/oidc/callback`;
  
  // Store pending auth info for the callback
  storeOIDCPendingAuth({
    cluster,
    authMethod,
    nonce,
    redirectUri,
    returnTo,
  });

  // Get the OIDC auth URL from Nomad
  const response = await getOIDCAuthURL(cluster, authMethod, redirectUri, nonce);
  
  // Open popup to OIDC provider
  const width = 500;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  
  const popup = window.open(
    response.auth_url,
    'oidc-login',
    `width=${width},height=${height},left=${left},top=${top},popup=true,toolbar=no,menubar=no`
  );

  return popup;
}

