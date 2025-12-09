import type { Route } from './Route';

/**
 * Should the route use a cluster URL?
 *
 * @param route
 * @returns true when a cluster URL contains cluster in the URL. eg. /c/minikube/my-url
 *   false, the URL does not contain the cluster. eg. /my-url
 */
export function getRouteUseClusterURL(route: Route): boolean {
  if (route.useClusterURL === undefined && route.noCluster !== undefined) {
    console.warn('Route.noCluster is deprecated. Please use route.useClusterURL instead.');
    return route.noCluster;
  }
  if (route.useClusterURL === undefined) {
    // default is true, so undefined === true.
    return true;
  }
  return route.useClusterURL;
}
