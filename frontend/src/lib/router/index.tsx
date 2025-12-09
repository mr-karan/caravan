import React from 'react';
import NotFoundComponent from '../../components/404';
import type { RouteURLProps } from './createRouteURL';
import { createRouteURL } from './createRouteURL';
import { getDefaultRoutes, setDefaultRoutes } from './getDefaultRoutes';
import { getRoute } from './getRoute';
import { getRoutePath } from './getRoutePath';
import { getRouteUseClusterURL } from './getRouteUseClusterURL';
import { Route } from './Route';
import { nomadRoutes } from './nomadRoutes';

export type { Route, RouteURLProps };
export { getDefaultRoutes, getRouteUseClusterURL, getRoutePath, getRoute, createRouteURL };

// Set Nomad routes as the default routes
setDefaultRoutes(nomadRoutes);

// The NotFound route needs to be considered always in the last place when used
// with the router switch, as any routes added after this one will never be considered.
// So we do not include it in the default routes in order to always "manually" consider it.
export const NotFoundRoute = {
  path: '*',
  exact: true,
  name: `Whoops! This page doesn't exist`,
  component: () => <NotFoundComponent />,
  sidebar: null,
  noAuthRequired: true,
};
