import { Deployment, AllocationListStub } from '../types';
import { get, post } from './requests';

export interface ListDeploymentsParams {
  namespace?: string;
  prefix?: string;
  filter?: string;
}

/**
 * List all deployments
 */
export function listDeployments(params?: ListDeploymentsParams): Promise<Deployment[]> {
  return get('/v1/deployments', params);
}

/**
 * Get a specific deployment
 */
export function getDeployment(deploymentId: string): Promise<Deployment> {
  return get(`/v1/deployment/${encodeURIComponent(deploymentId)}`);
}

/**
 * Promote a deployment (promote canaries)
 */
export function promoteDeployment(
  deploymentId: string,
  all = true,
  groups?: string[]
): Promise<{ EvalID: string; EvalCreateIndex: number; DeploymentModifyIndex: number }> {
  return post(`/v1/deployment/${encodeURIComponent(deploymentId)}/promote`, {
    All: all,
    Groups: groups,
  });
}

/**
 * Fail a deployment
 */
export function failDeployment(
  deploymentId: string
): Promise<{ EvalID: string; EvalCreateIndex: number; DeploymentModifyIndex: number }> {
  return post(`/v1/deployment/${encodeURIComponent(deploymentId)}/fail`);
}

/**
 * Pause or unpause a deployment
 */
export function pauseDeployment(
  deploymentId: string,
  pause: boolean
): Promise<{ EvalID: string; EvalCreateIndex: number; DeploymentModifyIndex: number }> {
  return post(`/v1/deployment/${encodeURIComponent(deploymentId)}/pause`, { Pause: pause });
}

/**
 * Get allocations for a deployment
 */
export function getDeploymentAllocations(deploymentId: string): Promise<AllocationListStub[]> {
  return get(`/v1/deployment/${encodeURIComponent(deploymentId)}/allocations`);
}
