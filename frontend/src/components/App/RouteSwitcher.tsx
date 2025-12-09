import React, { Suspense } from 'react';
import { useDispatch } from 'react-redux';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getCluster } from '../../lib/cluster';
import { NotFoundRoute } from '../../lib/router';
import { createRouteURL } from '../../lib/router/createRouteURL';
import { getDefaultRoutes } from '../../lib/router/getDefaultRoutes';
import { getRoutePath } from '../../lib/router/getRoutePath';
import { getRouteUseClusterURL } from '../../lib/router/getRouteUseClusterURL';
import { Route as RouteType } from '../../lib/router/Route';
import { useTypedSelector } from '../../redux/hooks';
import { uiSlice } from '../../redux/uiSlice';
import ErrorBoundary from '../common/ErrorBoundary';
import ErrorComponent from '../common/ErrorPage';
import { useSidebarItem } from '../Sidebar';

export default function RouteSwitcher(props: { requiresToken: () => boolean }) {
  const routes = useTypedSelector(state => state.routes.routes);
  const routeFilters = useTypedSelector(state => state.routes.routeFilters);
  const defaultRoutes = Object.values(getDefaultRoutes()).concat(NotFoundRoute);
  // Don't default to {} here - we need to distinguish null (not loaded) from {} (loaded but empty)
  const clusters = useTypedSelector(state => state.config.clusters);

  const filteredRoutes = Object.values(routes)
    .concat(defaultRoutes)
    .filter((route: RouteType) => {
      if (route.disabled) return false;
      if (routeFilters.length === 0) return true;
      // Apply all route filters - route passes if no filter returns null
      return routeFilters.every((filterFunc: (r: RouteType) => RouteType | null) => {
        return filterFunc(route) !== null;
      });
    });

  return (
    <Suspense fallback={null}>
      <Routes>
        {filteredRoutes.map((route: RouteType, index: number) =>
          route.name === 'OidcAuth' ? (
            <Route
              path={route.path}
              element={<RouteComponent route={route} />}
              key={index}
            />
          ) : (
            <Route
              path={getRoutePath(route)}
              element={
                <AuthRoute
                  sidebar={route.sidebar}
                  requiresAuth={!route.noAuthRequired}
                  requiresCluster={getRouteUseClusterURL(route)}
                  clusters={clusters}
                  requiresToken={props.requiresToken}
                >
                  <RouteComponent route={route} key={getCluster()} />
                </AuthRoute>
              }
              key={`${getCluster()}-${index}`}
            />
          )
        )}
      </Routes>
    </Suspense>
  );
}

function RouteErrorBoundary(props: { error: Error; route: RouteType }) {
  const { error, route } = props;

  return (
    <ErrorComponent
      title="Uh-oh! Something went wrong."
      error={error}
      message={`Error loading ${route.name}`}
    />
  );
}

function RouteComponent({ route }: { route: RouteType }) {
  
  const dispatch = useDispatch();

  React.useEffect(() => {
    dispatch(uiSlice.actions.setHideAppBar(route.hideAppBar));
  }, [route.hideAppBar]);

  React.useEffect(() => {
    dispatch(uiSlice.actions.setIsFullWidth(route.isFullWidth));
  }, [route.isFullWidth]);

  return (
    <PageTitle
      title={
        route.name
          ? route.name
          : typeof route.sidebar === 'string'
          ? route.sidebar
          : route.sidebar?.item || ''
      }
    >
      <ErrorBoundary
        fallback={(props: { error: Error }) => (
          <RouteErrorBoundary error={props.error} route={route} />
        )}
      >
        <route.component />
      </ErrorBoundary>
    </PageTitle>
  );
}

function PageTitle({
  title,
  children,
}: {
  title: string | null | undefined;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    document.title = title || '';
  }, [title]);

  return <>{children}</>;
}

interface AuthRouteProps {
  children: React.ReactNode;
  sidebar: RouteType['sidebar'];
  requiresAuth: boolean;
  requiresCluster: boolean;
  requiresToken: () => boolean;
  clusters?: Record<string, any> | null;
}

function AuthRoute(props: AuthRouteProps) {
  const {
    children,
    sidebar,
    requiresAuth = true,
    requiresCluster = true,
    clusters,
  } = props;

  const location = useLocation();
  const params = useParams();
  const redirectRoute = getCluster() ? 'token' : 'chooser';
  useSidebarItem(sidebar, params);

  if (!requiresAuth) {
    return <>{children}</>;
  }

  // For Nomad, we simplify auth - just check if cluster exists
  const cluster = getCluster();
  if (requiresCluster && cluster) {
    // If clusters hasn't loaded yet (null), don't redirect - wait for config to load
    // This prevents redirecting to home on initial page load before config is fetched
    if (clusters === null || clusters === undefined) {
      return <>{children}</>;
    }
    if (clusters[cluster]) {
      return <>{children}</>;
    }
    return (
      <Navigate
        to={createRouteURL(redirectRoute)}
        state={{ from: location }}
        replace
      />
    );
  }

  return <>{children}</>;
}

const PreviousRouteContext = React.createContext<number>(0);

export function PreviousRouteProvider({ children }: React.PropsWithChildren<{}>) {
  const location = useLocation();
  const navigate = useNavigate();
  const [locationInfo, setLocationInfo] = React.useState<number>(0);
  const prevLocationRef = React.useRef(location.key);

  React.useEffect(() => {
    // Track navigation by comparing location keys
    // This is a simplified approach since React Router v6+ doesn't expose action type directly
    if (location.key !== prevLocationRef.current) {
      // We can't easily distinguish PUSH from POP in v6+, so we just track that navigation happened
      // For a more accurate implementation, you'd need to use a custom history listener
      setLocationInfo(levels => levels + 1);
      prevLocationRef.current = location.key;
    }
  }, [location]);

  return (
    <PreviousRouteContext.Provider value={locationInfo}>{children}</PreviousRouteContext.Provider>
  );
}

export function useHasPreviousRoute() {
  const routeLevels = React.useContext(PreviousRouteContext);
  return routeLevels >= 1;
}
