import { Event } from '../types';
import { getAppUrl } from '../../../helpers/getAppUrl';
import { getCluster } from '../../cluster';

export type EventTopic = 'Job' | 'Allocation' | 'Node' | 'Deployment' | 'Evaluation' | 'Service' | '*';

export interface EventStreamOptions {
  topics?: EventTopic[];
  index?: number;
  namespace?: string;
  cluster?: string;
}

export interface EventStreamMessage {
  Events: Event[];
  Index: number;
}

/**
 * Create an EventSource for streaming Nomad events
 */
export function createEventStream(
  options: EventStreamOptions = {}
): EventSource {
  const { topics = ['*'], index = 0, namespace, cluster } = options;

  const params = new URLSearchParams();
  topics.forEach(topic => params.append('topic', topic));
  if (index > 0) {
    params.set('index', index.toString());
  }
  if (namespace) {
    params.set('namespace', namespace);
  }

  const clusterName = cluster || getCluster() || '';
  const url = `${getAppUrl()}api/clusters/${clusterName}/v1/event/stream?${params}`;

  return new EventSource(url);
}

/**
 * WebSocket-based event multiplexer connection
 * Useful for subscribing to events from multiple clusters
 */
export class EventMultiplexer {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Set<(event: Event) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.connect();
  }

  private connect() {
    const baseUrl = getAppUrl().replace(/^http/, 'ws');
    this.ws = new WebSocket(`${baseUrl}/wsMultiplexer`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // Re-subscribe to all existing subscriptions
      this.subscriptions.forEach((_, key) => {
        const [clusterId, userId] = key.split(':');
        this.sendSubscribe(clusterId, userId);
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'DATA') {
          const eventData = JSON.parse(message.data);
          const key = `${message.clusterId}:${message.userId}`;
          const callbacks = this.subscriptions.get(key);
          if (callbacks) {
            callbacks.forEach(cb => cb(eventData));
          }
        }
      } catch (err) {
        console.error('Error parsing event message:', err);
      }
    };

    this.ws.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
      }
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  private sendSubscribe(clusterId: string, userId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'SUBSCRIBE',
        clusterId,
        userId,
      }));
    }
  }

  private sendUnsubscribe(clusterId: string, userId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'UNSUBSCRIBE',
        clusterId,
        userId,
      }));
    }
  }

  /**
   * Subscribe to events for a cluster
   */
  subscribe(clusterId: string, userId: string, callback: (event: Event) => void): () => void {
    const key = `${clusterId}:${userId}`;

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
      this.sendSubscribe(clusterId, userId);
    }

    this.subscriptions.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(key);
          this.sendUnsubscribe(clusterId, userId);
        }
      }
    };
  }

  /**
   * Close the multiplexer connection
   */
  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
  }
}

// Singleton instance for event multiplexing
let multiplexerInstance: EventMultiplexer | null = null;

export function getEventMultiplexer(): EventMultiplexer {
  if (!multiplexerInstance) {
    multiplexerInstance = new EventMultiplexer();
  }
  return multiplexerInstance;
}
