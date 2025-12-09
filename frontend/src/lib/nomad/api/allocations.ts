import { Allocation, AllocationListStub, AllocResourceUsage, AllocFileInfo } from '../types';
import { get, post, nomadRequest } from './requests';
import { getCluster } from '../../cluster';
import { getAppUrl } from '../../../helpers/getAppUrl';
import { isDevMode } from '../../../helpers/isDevMode';

export interface ListAllocationsParams {
  namespace?: string;
  prefix?: string;
  filter?: string;
}

/**
 * List all allocations
 */
export function listAllocations(params?: ListAllocationsParams): Promise<AllocationListStub[]> {
  return get('/v1/allocations', params);
}

/**
 * Get a specific allocation
 */
export function getAllocation(allocId: string): Promise<Allocation> {
  return get(`/v1/allocation/${encodeURIComponent(allocId)}`);
}

/**
 * Restart an allocation task
 */
export function restartAllocation(
  allocId: string,
  taskName?: string,
  allTasks = false
): Promise<void> {
  return post(`/v1/allocation/${encodeURIComponent(allocId)}/restart`, {
    TaskName: taskName,
    AllTasks: allTasks,
  });
}

/**
 * Stop an allocation
 */
export function stopAllocation(allocId: string): Promise<void> {
  return post(`/v1/allocation/${encodeURIComponent(allocId)}/stop`);
}

/**
 * Get allocation resource usage stats
 */
export function getAllocationStats(allocId: string): Promise<AllocResourceUsage> {
  return get(`/v1/allocation/${encodeURIComponent(allocId)}/stats`);
}

/**
 * List files in allocation directory
 */
export function listAllocFiles(allocId: string, path = '/'): Promise<AllocFileInfo[]> {
  return get(`/v1/allocation/${encodeURIComponent(allocId)}/fs`, { path });
}

/**
 * Read a file from allocation
 */
export function readAllocFile(allocId: string, path: string): Promise<string> {
  return get(`/v1/allocation/${encodeURIComponent(allocId)}/file`, { path }, { isJSON: false }).then(
    (response: any) => response.text()
  );
}

/**
 * Stream allocation logs
 * Returns an EventSource for server-sent events
 */
export function streamAllocationLogs(
  allocId: string,
  taskName: string,
  logType: 'stdout' | 'stderr' = 'stdout',
  follow = true,
  origin: 'start' | 'end' = 'end',
  offset = 0,
  cluster?: string
): EventSource {
  const params = new URLSearchParams({
    type: logType,
    follow: follow.toString(),
    origin,
    offset: offset.toString(),
  });

  const baseUrl = window.location.origin;
  const clusterName = cluster || getCluster() || '';
  if (!clusterName) {
    throw new Error('No cluster context available. Please select a cluster first.');
  }
  const url = `${baseUrl}/api/clusters/${clusterName}/v1/allocation/${encodeURIComponent(allocId)}/logs/${encodeURIComponent(taskName)}?${params}`;

  return new EventSource(url);
}

/**
 * Create WebSocket connection for exec
 */
export function execInAllocation(
  allocId: string,
  taskName: string,
  command: string[],
  tty = true,
  cluster?: string
): WebSocket {
  // Backend splits command by space, so join the array
  const params = new URLSearchParams({
    command: command.join(' '),
    tty: tty.toString(),
  });

  const clusterName = cluster || getCluster() || '';
  
  if (!clusterName) {
    throw new Error('No cluster context available. Please select a cluster first.');
  }
  
  // In dev mode, connect through Vite proxy (ws://localhost:3000)
  // In production, connect directly to backend (ws://backend-url)
  let baseUrl: string;
  if (isDevMode()) {
    // Use window.location for dev mode to go through Vite proxy
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    baseUrl = `${protocol}//${window.location.host}`;
  } else {
    // Use getAppUrl() for production to connect directly to backend
    baseUrl = getAppUrl().replace(/^http/, 'ws').replace(/\/$/, ''); // Remove trailing slash
  }
  
  const url = `${baseUrl}/api/clusters/${clusterName}/v1/allocation/${encodeURIComponent(allocId)}/exec/${encodeURIComponent(taskName)}?${params}`;

  console.log('[execInAllocation] Creating WebSocket:', {
    url,
    clusterName,
    allocId,
    taskName,
    command: command.join(' '),
    isDevMode: isDevMode(),
  });

  const ws = new WebSocket(url);
  
  // Add error handler immediately to catch connection errors
  ws.addEventListener('error', (event) => {
    console.error('[execInAllocation] WebSocket error:', {
      url: ws.url,
      readyState: ws.readyState,
      event,
    });
  });
  
  return ws;
}
