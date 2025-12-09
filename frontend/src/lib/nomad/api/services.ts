import { ServiceRegistration } from '../types';
import { get } from './requests';

export interface ListServicesParams {
  namespace?: string;
  filter?: string;
}

export interface ServiceListStub {
  ServiceName: string;
  Tags: string[];
}

/**
 * List all services
 */
export function listServices(params?: ListServicesParams): Promise<ServiceListStub[]> {
  return get('/v1/services', params);
}

/**
 * Get service registrations by name
 */
export function getService(serviceName: string, namespace?: string): Promise<ServiceRegistration[]> {
  return get(`/v1/service/${encodeURIComponent(serviceName)}`, { namespace });
}
