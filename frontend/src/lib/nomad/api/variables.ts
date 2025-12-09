import { Variable, VariableMetadata } from '../types';
import { get, put, remove } from './requests';

export interface ListVariablesParams {
  namespace?: string;
  prefix?: string;
  filter?: string;
}

/**
 * List all variables (metadata only)
 */
export function listVariables(params?: ListVariablesParams): Promise<VariableMetadata[]> {
  return get('/v1/vars', params);
}

/**
 * Get a specific variable
 */
export function getVariable(path: string, namespace?: string): Promise<Variable> {
  return get('/v1/var', { path, namespace });
}

/**
 * Create or update a variable
 */
export function putVariable(
  path: string,
  items: Record<string, string>,
  namespace?: string
): Promise<Variable> {
  const query = `?path=${encodeURIComponent(path)}`;
  return put(`/v1/var${query}`, {
    path,
    items,
    namespace: namespace || 'default',
  });
}

/**
 * Delete a variable
 */
export function deleteVariable(path: string, namespace?: string): Promise<void> {
  return remove('/v1/var', { path, namespace });
}
