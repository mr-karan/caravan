import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Link from '@mui/material/Link';
import { styled } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Dispatch, UnknownAction } from '@reduxjs/toolkit';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCluster } from '../../lib/cluster';
import { restoreClustersToBackend, hasClusterToken } from '../../lib/clusterStorage';
import { getLastCluster, addToRecentClusters, setLastCluster } from '../../lib/clusterPreferences';
import { createRouteURL } from '../../lib/router/createRouteURL';
import useClusterViewState from '../../lib/useClusterViewState';
import { setConfig } from '../../redux/configSlice';
import { ConfigState } from '../../redux/configSlice';
import { useTypedSelector } from '../../redux/hooks';
import store from '../../redux/stores/store';
import { useUIPanelsGroupedBySide } from '../../redux/uiSlice';
import { ErrorPage, Loader } from '../common';
import ActionsNotifier from '../common/ActionsNotifier';
import AlertNotification from '../common/AlertNotification';
import Sidebar, { NavigationTabs } from '../Sidebar';
import ClusterErrorHandler from './ClusterErrorHandler';
import ClusterRail from './ClusterRail';
import { useClusterSwitchTransition } from './ClusterSwitchTransition';
import RouteSwitcher from './RouteSwitcher';
import TopBar from './TopBar';
import VersionDialog from './VersionDialog';

export interface LayoutProps {}

const CLUSTER_FETCH_INTERVAL = 10 * 1000; // ms

function ClusterNotFoundPopup({ cluster }: { cluster?: string }) {
  const problemCluster = cluster || getCluster();
  

  return (
    <Box
      display={'flex'}
      justifyContent="center"
      sx={{
        position: 'absolute',
        color: 'common.white',
        textAlign: 'center',
      }}
      bgcolor={'error.main'}
      zIndex={1400}
      width={'100%'}
      p={0.5}
      alignItems="center"
    >
      <Box p={0.5}>
        Something went wrong with cluster {problemCluster}
      </Box>
      <Button variant="contained" size="small" href="/">
        Choose another cluster
      </Button>
    </Box>
  );
}
const Div = styled('div')``;
const Main = styled('main')``;

declare global {
  interface Window {
    clusterConfigFetchHandler: number;
  }
}

// Track if we've already restored clusters from localStorage
let clustersRestored = false;
// Promise that resolves when clusters are restored (for components to await)
let clustersRestoredPromise: Promise<void> | null = null;

/**
 * Wait for clusters to be restored from localStorage.
 * Can be called from any component that needs to wait for cluster restoration.
 */
export async function waitForClustersRestored(): Promise<void> {
  if (clustersRestored) return;
  if (clustersRestoredPromise) {
    await clustersRestoredPromise;
  }
}

/**
 * Fetches the cluster config from the backend and updates the redux store.
 * On first load, restores clusters from localStorage to the backend.
 */
const fetchConfig = async (dispatch: Dispatch<UnknownAction>) => {
  const clusters = store.getState().config.clusters;

  try {
    // On first load, restore clusters from localStorage to backend
    if (!clustersRestored) {
      // Create a promise that other components can await
      clustersRestoredPromise = (async () => {
        await restoreClustersToBackend();
        clustersRestored = true;
      })();
      await clustersRestoredPromise;
    }

    const response = await fetch('/config');
    const config = await response.json();

    const clustersToConfig: ConfigState['clusters'] = {};
    if (config?.clusters) {
      config.clusters.forEach((cluster: { name: string; server?: string }) => {
        clustersToConfig[cluster.name] = {
          name: cluster.name,
          server: cluster.server || '',
        };
      });
    }

    const configToStore = { ...config, clusters: clustersToConfig };

    if (clusters === null) {
      dispatch(setConfig(configToStore));
    } else {
      dispatch(setConfig(configToStore));
    }

    return configToStore;
  } catch (error) {
    console.error('Failed to fetch config:', error);
    // Return empty config on error
    return { clusters: {} };
  }
};

const disableBackendLoader = true;

export default function Layout({}: LayoutProps) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const clusters = useTypedSelector(state => state.config.clusters);
  const isFullWidth = useTypedSelector(state => state.ui.isFullWidth);
  const [ready, setReady] = useState(clustersRestored);
  const isSmallScreen = useMediaQuery('(max-width:600px)');
  const [hasAutoSelectedCluster, setHasAutoSelectedCluster] = useState(false);

  // Cluster switch transition
  const { TransitionOverlay } = useClusterSwitchTransition();

  // Determine if we should show the cluster rail (multiple clusters, not on small screens)
  const clusterCount = clusters ? Object.keys(clusters).length : 0;
  const showClusterRail = clusterCount > 1 && !isSmallScreen;
  
  // Track current cluster for activity logging
  const currentCluster = getCluster();
  const prevClusterRef = useRef<string | null>(null);

  // Log cluster activity when switching
  useEffect(() => {
    if (currentCluster && currentCluster !== prevClusterRef.current) {
      addToRecentClusters(currentCluster);
      setLastCluster(currentCluster);
      prevClusterRef.current = currentCluster;
    }
  }, [currentCluster]);

  // Per-cluster view state persistence (namespace filters, etc.)
  useClusterViewState({ autoSave: true });

  // Auto-select last used cluster on app start
  useEffect(() => {
    if (hasAutoSelectedCluster || !ready || !clusters) return;
    
    // Only auto-select if we're on the home/clusters page
    if (location.pathname !== '/' && location.pathname !== '/clusters') return;
    
    const lastCluster = getLastCluster();
    if (lastCluster && clusters[lastCluster]) {
      setHasAutoSelectedCluster(true);
      
      // Check if we have a valid token for this cluster
      if (hasClusterToken(lastCluster)) {
        // Small delay to let the UI settle
        setTimeout(() => {
          navigate(createRouteURL('nomadCluster', { cluster: lastCluster }));
        }, 100);
      }
    } else {
      setHasAutoSelectedCluster(true);
    }
  }, [ready, clusters, location.pathname, navigate, hasAutoSelectedCluster]);

  const {
    data: config,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['cluster-fetch'],
    queryFn: () => fetchConfig(dispatch),
    refetchInterval: disableBackendLoader
      ? CLUSTER_FETCH_INTERVAL
      : (query: any) => (query.state.status === 'error' ? false : CLUSTER_FETCH_INTERVAL),
  });

  // Mark ready once clusters are restored
  useEffect(() => {
    if (clustersRestored) {
      setReady(true);
    } else if (clustersRestoredPromise) {
      clustersRestoredPromise.then(() => setReady(true));
    }
  }, [config]);

  // Remove splash screen styles from the body
  useEffect(() => {
    document.body.removeAttribute('style');
  }, []);

  const containerProps = isFullWidth
    ? ({ maxWidth: false, disableGutters: true } as const)
    : ({ maxWidth: 'xl' } as const);

  const panels = useUIPanelsGroupedBySide();

  // Show loader while clusters are being restored
  if (!ready) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100dvw',
          height: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          animation: 'loader-appear',
          animationFillMode: 'both',
          animationDelay: '0.5s',
          animationDuration: '0.3s',

          '@keyframes loader-appear': {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
        }}
      >
        <Loader title="Loading clusters..." />
        <Typography>Restoring clusters...</Typography>
      </Box>
    );
  }

  if (!disableBackendLoader) {
    if (error && !config) {
      return <ErrorPage message="Failed to connect to the backend" error={error} />;
    }

    if (isLoading) {
      return (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100dvw',
            height: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            animation: 'loader-appear',
            animationFillMode: 'both',
            animationDelay: '2s',
            animationDuration: '0.3s',

            '@keyframes loader-appear': {
              from: { opacity: 0 },
              to: { opacity: 1 },
            },
          }}
        >
          <Loader title="Connecting to backend..." />
          <Typography>Connecting to backend...</Typography>
        </Box>
      );
    }
  }

  return (
    <>
      <Link
        href="#main"
        sx={{
          border: 0,
          clip: 'rect(0 0 0 0)',
          height: '1px',
          margin: -1,
          overflow: 'hidden',
          padding: 0,
          position: 'absolute',
          whiteSpace: 'nowrap',
          width: '1px',
        }}
      >
        Skip to main content
      </Link>
      <VersionDialog />
      <CssBaseline enableColorScheme />
      <ActionsNotifier />
      <TransitionOverlay />
      <Box sx={{ display: 'flex', height: '100dvh' }}>
        {/* Slack-like cluster rail on the far left */}
        {showClusterRail && <ClusterRail />}
        {panels.left.map((it: any) => (
          <it.component key={it.id} />
        ))}
        <Box
          sx={{
            display: 'flex',
            overflow: 'auto',
            flexDirection: 'column',
            flexGrow: 1,
          }}
        >
          {panels.top.map((it: any) => (
            <it.component key={it.id} />
          ))}
          <TopBar />
          <ClusterErrorHandler />
          <Box
            sx={{
              display: 'grid',
              overflow: 'hidden',
              flexGrow: 1,
              position: 'relative',
              gridTemplateRows: '1fr min-content',
              gridTemplateColumns: 'min-content 1fr',
            }}
          >
            <Sidebar />
            <Main
              id="main"
              sx={{
                overflow: 'auto',
                position: 'relative',
                minHeight: 0,
                gridColumn: '2 / 3',
                gridRow: '1 / 2',
              }}
            >
              <AlertNotification />
              <Box sx={{ height: '100%' }}>
                <Div />
                <Container {...containerProps} sx={{ height: '100%' }}>
                  <NavigationTabs />
                  <RouteSwitcher
                    requiresToken={() => {
                      const clusterName = getCluster() || '';
                      const cluster = clusters ? clusters[clusterName] : undefined;
                      return (cluster as any)?.useToken === undefined || (cluster as any)?.useToken;
                    }}
                  />
                </Container>
              </Box>
            </Main>
          </Box>
          {panels.bottom.map((it: any) => (
            <it.component key={it.id} />
          ))}
        </Box>
        {panels.right.map((it: any) => (
          <it.component key={it.id} />
        ))}
      </Box>
    </>
  );
}
