import { getClusterPrefixedPath } from '../cluster';
import { NotFoundRoute } from '.';
import { getRouteUseClusterURL } from './getRouteUseClusterURL';
import type { Route } from './Route';

export function getRoutePath(route: Route) {
  if (route.path === NotFoundRoute.path) {
    return route.path;
  }
  if (!getRouteUseClusterURL(route)) {
    return route.path;
  }

  return getClusterPrefixedPath(route.path);
}
