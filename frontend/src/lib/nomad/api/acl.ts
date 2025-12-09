import { ACLToken, ACLPolicy } from '../types';
import { get } from './requests';

export interface ListACLTokensParams {
  prefix?: string;
  filter?: string;
}

export interface ListACLPoliciesParams {
  prefix?: string;
  filter?: string;
}

/**
 * List all ACL tokens
 */
export function listACLTokens(params?: ListACLTokensParams): Promise<ACLToken[]> {
  return get('/v1/acl/tokens', params);
}

/**
 * Get the current user's ACL token
 */
export function getSelfToken(): Promise<ACLToken> {
  return get('/v1/acl/token/self');
}

/**
 * Get a specific ACL token
 */
export function getACLToken(accessorId: string): Promise<ACLToken> {
  return get(`/v1/acl/token/${encodeURIComponent(accessorId)}`);
}

/**
 * List all ACL policies
 */
export function listACLPolicies(params?: ListACLPoliciesParams): Promise<ACLPolicy[]> {
  return get('/v1/acl/policies', params);
}

/**
 * Get a specific ACL policy
 */
export function getACLPolicy(policyName: string): Promise<ACLPolicy> {
  return get(`/v1/acl/policy/${encodeURIComponent(policyName)}`);
}
