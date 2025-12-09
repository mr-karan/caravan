import { Node, NodeListStub, AllocationListStub } from '../types';
import { get, post } from './requests';

export interface ListNodesParams {
  prefix?: string;
  filter?: string;
}

/**
 * List all nodes
 */
export function listNodes(params?: ListNodesParams): Promise<NodeListStub[]> {
  return get('/v1/nodes', params);
}

/**
 * Get a specific node
 */
export function getNode(nodeId: string): Promise<Node> {
  return get(`/v1/node/${encodeURIComponent(nodeId)}`);
}

/**
 * Set node drain status
 */
export function drainNode(
  nodeId: string,
  enable: boolean,
  deadline?: string,
  force = false,
  ignoreSystem = false
): Promise<{ EvalIDs: string[]; EvalCreateIndex: number; NodeModifyIndex: number }> {
  return post(`/v1/node/${encodeURIComponent(nodeId)}/drain`, {
    enable,
    deadline,
    force,
    ignoreSystem,
  });
}

/**
 * Set node scheduling eligibility
 */
export function setNodeEligibility(
  nodeId: string,
  eligible: boolean
): Promise<{ EvalIDs: string[]; EvalCreateIndex: number; NodeModifyIndex: number }> {
  return post(`/v1/node/${encodeURIComponent(nodeId)}/eligibility`, { eligible });
}

/**
 * Get allocations for a node
 */
export function getNodeAllocations(nodeId: string): Promise<AllocationListStub[]> {
  return get(`/v1/node/${encodeURIComponent(nodeId)}/allocations`);
}
