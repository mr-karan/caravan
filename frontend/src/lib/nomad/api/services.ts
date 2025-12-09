import { ServiceRegistration } from '../types';
import { get } from './requests';

export interface ListServicesParams {
  namespace?: string;
  filter?: string;
}

export interface ServiceListStub {
  ServiceName: string;
  Tags: string[];
  Namespace?: string;
}

/**
 * List all services
 */
export function listServices(params?: ListServicesParams): Promise<ServiceListStub[]> {
  return get('/v1/services', params);
}

/**
 * Get service registrations by name
 * Note: Nomad API doesn't support namespace=* for single service queries
 */
export function getService(serviceName: string, namespace?: string): Promise<ServiceRegistration[]> {
  return get(`/v1/service/${encodeURIComponent(serviceName)}`, { namespace });
}

/**
 * Get service registrations across all namespaces
 * Since Nomad doesn't support namespace=* for /v1/service/{name}, 
 * we first list all services to find namespaces, then query each
 */
export async function getServiceAllNamespaces(serviceName: string): Promise<ServiceRegistration[]> {
  // First, list all services with namespace=* to find which namespaces have this service
  const allServices = await listServices({ namespace: '*' });
  
  // Find all namespaces that have this service
  const namespacesWithService = new Set<string>();
  
  for (const svc of allServices) {
    if (svc.ServiceName === serviceName && svc.Namespace) {
      namespacesWithService.add(svc.Namespace);
    }
  }
  
  // If no namespaces found, try default namespace
  if (namespacesWithService.size === 0) {
    namespacesWithService.add('default');
  }
  
  // Query each namespace and combine results
  const results: ServiceRegistration[] = [];
  
  await Promise.all(
    Array.from(namespacesWithService).map(async ns => {
      try {
        const registrations = await getService(serviceName, ns);
        if (registrations && registrations.length > 0) {
          results.push(...registrations);
        }
      } catch (err) {
        // Ignore errors for individual namespace queries
        console.warn(`Failed to get service ${serviceName} in namespace ${ns}:`, err);
      }
    })
  );
  
  return results;
}
