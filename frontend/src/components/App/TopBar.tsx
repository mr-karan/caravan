import { Icon } from '@iconify/react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useTheme } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { has } from 'lodash';
import React, { memo, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getProductName, getVersion } from '../../helpers/getProductInfo';
import { getCluster } from '../../lib/cluster';
import { createRouteURL } from '../../lib/router/createRouteURL';
import {
  AppBarAction,
  AppBarActionsProcessor,
  AppBarActionType,
  DefaultAppBarAction,
} from '../../redux/actionButtonsSlice';
import { useTypedSelector } from '../../redux/hooks';
import { uiSlice } from '../../redux/uiSlice';
import { SettingsButton } from '../App/Settings';
import ErrorBoundary from '../common/ErrorBoundary';
import CaravanButton from '../Sidebar/CaravanButton';
import { setWhetherSidebarOpen } from '../Sidebar/sidebarSlice';
import { alpha, Chip } from '@mui/material';
import { AppLogo } from './AppLogo';
import ClusterSwitcher from './ClusterSwitcher';
import GlobalSearch from './GlobalSearch';
import ClusterAvatar from '../common/ClusterAvatar';

/**
 * Simple cluster indicator shown when the cluster rail is visible.
 * Just displays the current cluster name without dropdown functionality.
 */
function ClusterIndicator({ clusterName }: { clusterName: string }) {
  const theme = useTheme();
  
  return (
    <Chip
      avatar={<ClusterAvatar name={clusterName} size={24} />}
      label={clusterName}
      variant="outlined"
      sx={{
        height: 32,
        borderRadius: 2,
        backgroundColor: alpha(theme.palette.primary.main, 0.04),
        borderColor: theme.palette.divider,
        '& .MuiChip-avatar': {
          width: 24,
          height: 24,
          ml: 0.5,
        },
        '& .MuiChip-label': {
          fontWeight: 500,
          fontSize: '0.8125rem',
          px: 1,
        },
      }}
    />
  );
}

export interface TopBarProps {}

export function useAppBarActionsProcessed() {
  const appBarActions = useTypedSelector(state => state.actionButtons.appBarActions);
  const appBarActionsProcessors = useTypedSelector(
    state => state.actionButtons.appBarActionsProcessors
  );

  return { appBarActions, appBarActionsProcessors };
}

export function processAppBarActions(
  appBarActions: AppBarAction[],
  appBarActionsProcessors: AppBarActionsProcessor[]
): AppBarAction[] {
  let appBarActionsProcessed = [...appBarActions];
  for (const appBarActionsProcessor of appBarActionsProcessors) {
    appBarActionsProcessed = appBarActionsProcessor.processor({ actions: appBarActionsProcessed });
  }
  return appBarActionsProcessed;
}

// ClusterTitle is now replaced by ClusterSwitcher for better multi-cluster UX

export default function TopBar({}: TopBarProps) {
  const dispatch = useDispatch();
  const isMedium = useMediaQuery('(max-width:960px)');
  const isSmallScreen = useMediaQuery('(max-width:600px)');

  const isSidebarOpen = useTypedSelector(state => state.sidebar.isSidebarOpen);
  const isSidebarOpenUserSelected = useTypedSelector(
    state => state.sidebar.isSidebarOpenUserSelected
  );
  const hideAppBar = useTypedSelector(state => state.ui.hideAppBar);
  const clusters = useTypedSelector(state => state.config.clusters) || {};
  
  // Check if cluster rail is visible (same logic as Layout)
  const clusterCount = Object.keys(clusters).length;
  const isClusterRailVisible = clusterCount > 1 && !isSmallScreen;

  const cluster = getCluster();
  const navigate = useNavigate();
  const { appBarActions, appBarActionsProcessors } = useAppBarActionsProcessed();

  const logoutCallback = useCallback(async () => {
    navigate('/clusters');
  }, [navigate]);

  const handletoggleOpen = useCallback(() => {
    const openSideBar = isMedium && isSidebarOpenUserSelected === undefined ? false : isSidebarOpen;
    dispatch(setWhetherSidebarOpen(!openSideBar));
  }, [isMedium, isSidebarOpenUserSelected, isSidebarOpen]);

  if (hideAppBar) {
    return null;
  }
  return (
    <PureTopBar
      appBarActions={appBarActions}
      appBarActionsProcessors={appBarActionsProcessors}
      logout={logoutCallback}
      isSidebarOpen={isSidebarOpen}
      isSidebarOpenUserSelected={isSidebarOpenUserSelected}
      onToggleOpen={handletoggleOpen}
      cluster={cluster || undefined}
      clusters={clusters}
      isClusterRailVisible={isClusterRailVisible}
    />
  );
}

export interface PureTopBarProps {
  appBarActions: AppBarAction[];
  appBarActionsProcessors?: AppBarActionsProcessor[];
  logout: () => Promise<any> | void;
  clusters?: {
    [clusterName: string]: any;
  };
  cluster?: string;
  isSidebarOpen?: boolean;
  isSidebarOpenUserSelected?: boolean;
  onToggleOpen: () => void;
  /** Whether the cluster rail is visible (hides cluster switcher dropdown) */
  isClusterRailVisible?: boolean;
}

function AppBarActionsMenu({
  appBarActions,
}: {
  appBarActions: Array<AppBarAction | AppBarActionType>;
}) {
  const actions = (function stateActions() {
    return React.Children.toArray(
      appBarActions.map(action => {
        const Action = has(action, 'action') ? action.action : action;
        if (React.isValidElement(Action)) {
          return (
            <ErrorBoundary>
              <MenuItem>{Action}</MenuItem>
            </ErrorBoundary>
          );
        } else if (Action === null) {
          return null;
        } else if (typeof Action === 'function') {
          const ActionComponent = Action as React.FC;
          return (
            <ErrorBoundary>
              <MenuItem>
                <ActionComponent />
              </MenuItem>
            </ErrorBoundary>
          );
        }
      })
    );
  })();

  return <>{actions}</>;
}

function AppBarActions({
  appBarActions,
}: {
  appBarActions: Array<AppBarAction | AppBarActionType>;
}) {
  const actions = (function stateActions() {
    return React.Children.toArray(
      appBarActions.map((action, index) => {
        const Action = has(action, 'action') ? action.action : action;
        const actionId = has(action, 'id') ? String(action.id) : `action-${index}`;
        if (React.isValidElement(Action)) {
          return <ErrorBoundary key={actionId}>{Action}</ErrorBoundary>;
        } else if (Action === null) {
          return null;
        } else if (typeof Action === 'function') {
          const ActionComponent = Action as React.FC;
          return (
            <ErrorBoundary key={actionId}>
              <ActionComponent />
            </ErrorBoundary>
          );
        }
      })
    );
  })();

  return <>{actions}</>;
}

export const PureTopBar = memo(
  ({
    appBarActions,
    appBarActionsProcessors = [],
    logout,
    cluster,
    clusters,
    isSidebarOpen,
    isSidebarOpenUserSelected,
    onToggleOpen,
    isClusterRailVisible = false,
  }: PureTopBarProps) => {
    
    const theme = useTheme();
    const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const openSideBar = !!(isSidebarOpenUserSelected === undefined ? false : isSidebarOpen);

    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [mobileMoreAnchorEl, setMobileMoreAnchorEl] = React.useState<null | HTMLElement>(null);
    const isClusterContext = !!cluster;
    
    // Don't show ClusterSwitcher dropdown when rail is visible (rail handles switching)
    const showClusterSwitcher = isClusterContext && !isClusterRailVisible;

    const isMenuOpen = Boolean(anchorEl);
    const isMobileMenuOpen = Boolean(mobileMoreAnchorEl);

    const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget);
    };

    const handleMobileMenuClose = () => {
      setMobileMoreAnchorEl(null);
    };

    const handleMenuClose = () => {
      setAnchorEl(null);
      handleMobileMenuClose();
    };

    const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
      setMobileMoreAnchorEl(event.currentTarget);
    };

    const userMenuId = 'primary-user-menu';

    const renderUserMenu = !!isClusterContext && (
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        id={userMenuId}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={isMenuOpen}
        onClose={() => {
          handleMenuClose();
          handleMobileMenuClose();
        }}
        style={{ zIndex: 1400 }}
        sx={{
          '& .MuiMenu-list': {
            paddingBottom: 0,
          },
        }}
      >
        <MenuItem
          component="a"
          onClick={async () => {
            await logout();
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <Icon icon="mdi:logout" />
          </ListItemIcon>
          <ListItemText primary="Log out" />
        </MenuItem>
        <MenuItem
          component="a"
          onClick={() => {
            navigate(createRouteURL('settings'));
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <Icon icon="mdi:cog-box" />
          </ListItemIcon>
          <ListItemText>General Settings</ListItemText>
        </MenuItem>
        <MenuItem
          component="a"
          onClick={() => {
            dispatch(uiSlice.actions.setVersionDialogOpen(true));
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <Icon icon="mdi:information-outline" />
          </ListItemIcon>
          <ListItemText>
            {getProductName()} {getVersion()['VERSION']}
          </ListItemText>
        </MenuItem>
      </Menu>
    );

    const mobileMenuId = 'primary-menu-mobile';
    const allAppBarActionsMobile: AppBarAction[] = [
      {
        id: DefaultAppBarAction.CLUSTER,
        action: showClusterSwitcher && <ClusterSwitcher />,
      },
      ...appBarActions,
      {
        id: DefaultAppBarAction.NOTIFICATION,
        action: null,
      },
      {
        id: DefaultAppBarAction.SETTINGS,
        action: <SettingsButton onClickExtra={handleMenuClose} />,
      },
      {
        id: DefaultAppBarAction.USER,
        action: !!isClusterContext && (
          <IconButton
            aria-label="Account of current user"
            aria-controls={userMenuId}
            aria-haspopup="true"
            color="inherit"
            onClick={event => {
              handleMenuClose();
              handleProfileMenuOpen(event);
            }}
            size="medium"
          >
            <Icon icon="mdi:account" />
          </IconButton>
        ),
      },
    ];

    const renderMobileMenu = (
      <Menu
        anchorEl={mobileMoreAnchorEl}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        id={mobileMenuId}
        keepMounted
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={isMobileMenuOpen}
        onClose={handleMobileMenuClose}
      >
        <AppBarActionsMenu
          appBarActions={processAppBarActions(allAppBarActionsMobile, appBarActionsProcessors)}
        />
      </Menu>
    );

    const allAppBarActions: AppBarAction[] = [
      {
        id: DefaultAppBarAction.CLUSTER,
        action: isClusterContext && (
          showClusterSwitcher ? <ClusterSwitcher /> : <ClusterIndicator clusterName={cluster!} />
        ),
      },
      ...appBarActions,
      {
        id: DefaultAppBarAction.NOTIFICATION,
        action: null,
      },
      {
        id: 'global-search',
        action: <GlobalSearch />,
      },
      {
        id: DefaultAppBarAction.SETTINGS,
        action: <SettingsButton onClickExtra={handleMenuClose} />,
      },
      {
        id: DefaultAppBarAction.USER,
        action: !!isClusterContext && (
          <IconButton
            aria-label="Account of current user"
            aria-controls={userMenuId}
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
            size="medium"
          >
            <Icon icon="mdi:account" />
          </IconButton>
        ),
      },
    ];

    const visibleMobileActions = processAppBarActions(
      allAppBarActionsMobile,
      appBarActionsProcessors
    ).filter(action => React.isValidElement(action.action) || typeof action === 'function');

    return (
      <>
        <AppBar
          position="static"
          sx={theme => ({
            backgroundImage: 'none',
            zIndex: theme.zIndex.drawer + 1,
            color:
              theme.palette.navbar.color ??
              theme.palette.getContrastText(theme.palette.navbar.background),
            backgroundColor: theme.palette.navbar.background,
            boxShadow: 'none',
            borderBottom: '1px solid #eee',
            borderColor: theme.palette.divider,
          })}
          elevation={1}
          component="nav"
          aria-label="Appbar Tools"
          enableColorOnDark
        >
          <Toolbar
            sx={{
              [theme.breakpoints.down('sm')]: {
                paddingLeft: 0,
                paddingRight: 0,
              },
            }}
          >
            {isSmall ? (
              <>
                <CaravanButton open={openSideBar} onToggleOpen={onToggleOpen} />
                <Box sx={{ flexGrow: 1 }} />
                {visibleMobileActions.length > 0 && (
                  <IconButton
                    aria-label="show more"
                    aria-controls={mobileMenuId}
                    aria-haspopup="true"
                    onClick={handleMobileMenuOpen}
                    color="inherit"
                    size="medium"
                  >
                    <Icon icon="mdi:more-vert" />
                  </IconButton>
                )}
              </>
            ) : (
              <>
                <AppLogo />
                <Box sx={{ ml: 2, flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                  <AppBarActions
                    appBarActions={processAppBarActions(allAppBarActions, appBarActionsProcessors)}
                  />
                </Box>
              </>
            )}
          </Toolbar>
        </AppBar>
        {renderUserMenu}
        {isSmall && renderMobileMenu}
      </>
    );
  }
);
