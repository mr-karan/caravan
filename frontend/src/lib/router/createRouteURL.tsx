import { generatePath } from 'react-router';
import type { AppStore } from '../../redux/stores/store';
import { encodeClusterName, getClusterPathParam } from '../cluster';
import { getRoute } from './getRoute';
import { getRoutePath } from './getRoutePath';
import { getRouteUseClusterURL } from './getRouteUseClusterURL';

export interface RouteURLProps {
  /**
   * Selected clusters path parameter
   *
   * Check out {@link getClusterPathParam} and {@link formatClusterPathParam} function
   * for working with this parameter
   */
  cluster?: string;
  [prop: string]: any;
}

const storeRef: { current?: AppStore } = { current: undefined };

function getStore() {
  return storeRef.current;
}
/**
 * This is so we can access the store from anywhere, but not import it directly.
 * @param newStore
 */
export function setStore(newStore: AppStore) {
  storeRef.current = newStore;
}

export function createRouteURL(routeName?: string, params: RouteURLProps = {}) {
  if (!routeName) return '';

  const store = getStore();
  const storeRoutes = !store ? {} : store.getState().routes.routes;

  // First try to find by name
  const matchingStoredRouteByName =
    storeRoutes &&
    Object.entries(storeRoutes).find(
      ([, route]) => route.name?.toLowerCase() === routeName.toLowerCase()
    )?.[1];

  // Then try to find by path
  const matchingStoredRouteByPath =
    storeRoutes &&
    Object.entries(storeRoutes).find(([key]) => key.toLowerCase() === routeName.toLowerCase())?.[1];

  if (matchingStoredRouteByPath && !matchingStoredRouteByName) {
    console.warn(
      `[Deprecation] Route "${routeName}" was found by path instead of name. ` +
        'Please use route names instead of paths when calling createRouteURL.'
    );
  }

  const route = matchingStoredRouteByName || matchingStoredRouteByPath || getRoute(routeName);

  if (!route) {
    return '';
  }

  // Get cluster: either from params (needs encoding) or from URL (already encoded)
  let cluster = params.cluster ? encodeClusterName(params.cluster) : undefined;
  if (!cluster && getRouteUseClusterURL(route)) {
    cluster = getClusterPathParam(); // Already encoded from URL
    if (!cluster) {
      return '/';
    }
  }
  const fullParams = {
    selected: undefined,
    ...params,
  };

  // Add encoded cluster to the params if it is not already there
  if (!fullParams.cluster && !!cluster) {
    fullParams.cluster = cluster;
  } else if (fullParams.cluster) {
    // Encode cluster from params
    fullParams.cluster = encodeClusterName(fullParams.cluster);
  }

  // @todo: Remove this hack once we support redirection in routes
  if (routeName === 'settingsCluster') {
    return `/settings/cluster?c=${encodeURIComponent(fullParams.cluster || '')}`;
  }

  const url = getRoutePath(route);
  return generatePath(url, fullParams);
}
