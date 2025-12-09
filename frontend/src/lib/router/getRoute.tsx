import { getDefaultRoutes } from './getDefaultRoutes';

export function getRoute(routeName?: string) {
  if (!routeName) return;

  let routeKey = routeName;
  for (const key in getDefaultRoutes()) {
    if (key.toLowerCase() === routeName.toLowerCase()) {
      // if (key !== routeName) {
      //   console.warn(`Route name ${routeName} and ${key} are not matching`);
      // }
      routeKey = key;
      break;
    }
  }
  return getDefaultRoutes()[routeKey];
}
