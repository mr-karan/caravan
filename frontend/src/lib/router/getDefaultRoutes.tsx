import type { Route } from './Route';

/** @private */
const DEFAULT_ROUTES: { [routeName: string]: Route } = {};

export function getDefaultRoutes() {
  return DEFAULT_ROUTES;
}

export function setDefaultRoutes(routes: { [routeName: string]: Route }) {
  // remove all existing keys
  Object.keys(DEFAULT_ROUTES).forEach(k => {
    delete DEFAULT_ROUTES[k];
  });

  // copy in the new routes
  Object.assign(DEFAULT_ROUTES, routes);
}
