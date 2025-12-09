import { Namespace } from '../types';
import { get } from './requests';

export interface ListNamespacesParams {
  prefix?: string;
  filter?: string;
}

/**
 * List all namespaces
 */
export function listNamespaces(params?: ListNamespacesParams): Promise<Namespace[]> {
  return get('/v1/namespaces', params);
}

/**
 * Get a specific namespace
 */
export function getNamespace(name: string): Promise<Namespace> {
  return get(`/v1/namespace/${encodeURIComponent(name)}`);
}
