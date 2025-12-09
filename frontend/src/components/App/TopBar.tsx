import { Icon } from '@iconify/react';
import {
  alpha,
  AppBar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  useTheme,
} from '@mui/material';
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
import { AppLogo } from './AppLogo';
import ClusterSwitcher from './ClusterSwitcher';
import GlobalSearch from './GlobalSearch';

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

export default function TopBar({}: TopBarProps) {
  const dispatch = useDispatch();
  const isMedium = useMediaQuery('(max-width:960px)');

  const isSidebarOpen = useTypedSelector(state => state.sidebar.isSidebarOpen);
  const isSidebarOpenUserSelected = useTypedSelector(
    state => state.sidebar.isSidebarOpenUserSelected
  );
  const hideAppBar = useTypedSelector(state => state.ui.hideAppBar);
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
    />
  );
}

export interface PureTopBarProps {
  appBarActions: AppBarAction[];
  appBarActionsProcessors?: AppBarActionsProcessor[];
  logout: () => Promise<any> | void;
  isSidebarOpen?: boolean;
  isSidebarOpenUserSelected?: boolean;
  onToggleOpen: () => void;
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

// Styled icon button for consistent look
function TopBarIconButton({
  icon,
  tooltip,
  onClick,
  active,
}: {
  icon: string;
  tooltip: string;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  active?: boolean;
}) {
  const theme = useTheme();

  return (
    <Tooltip title={tooltip}>
      <IconButton
        onClick={onClick}
        size="small"
        sx={{
          width: 36,
          height: 36,
          color: theme.palette.navbar.color ?? theme.palette.text.primary,
          backgroundColor: active ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
          },
        }}
      >
        <Icon icon={icon} width={20} />
      </IconButton>
    </Tooltip>
  );
}

export const PureTopBar = memo(
  ({
    appBarActions,
    appBarActionsProcessors = [],
    logout,
    isSidebarOpen,
    isSidebarOpenUserSelected,
    onToggleOpen,
  }: PureTopBarProps) => {
    const theme = useTheme();
    const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const cluster = getCluster();
    const isClusterContext = !!cluster;

    const openSideBar = !!(isSidebarOpenUserSelected === undefined ? false : isSidebarOpen);

    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [mobileMoreAnchorEl, setMobileMoreAnchorEl] = React.useState<null | HTMLElement>(null);

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
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        id={userMenuId}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={isMenuOpen}
        onClose={handleMenuClose}
        PaperProps={{
          elevation: 3,
          sx: {
            minWidth: 200,
            mt: 1,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <MenuItem
          onClick={() => {
            navigate(createRouteURL('settings'));
            handleMenuClose();
          }}
          sx={{ py: 1.25 }}
        >
          <ListItemIcon>
            <Icon icon="mdi:cog-outline" width={20} />
          </ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            dispatch(uiSlice.actions.setVersionDialogOpen(true));
            handleMenuClose();
          }}
          sx={{ py: 1.25 }}
        >
          <ListItemIcon>
            <Icon icon="mdi:information-outline" width={20} />
          </ListItemIcon>
          <ListItemText>
            {getProductName()} {getVersion()['VERSION']}
          </ListItemText>
        </MenuItem>
        <Divider sx={{ my: 1 }} />
        <MenuItem
          onClick={async () => {
            await logout();
            handleMenuClose();
          }}
          sx={{ py: 1.25, color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
            <Icon icon="mdi:logout" width={20} />
          </ListItemIcon>
          <ListItemText>Sign out</ListItemText>
        </MenuItem>
      </Menu>
    );

    const mobileMenuId = 'primary-menu-mobile';
    const allAppBarActionsMobile: AppBarAction[] = [
      {
        id: DefaultAppBarAction.CLUSTER,
        action: <ClusterSwitcher />,
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
          <TopBarIconButton
            icon="mdi:account-circle"
            tooltip="Account"
            onClick={e => {
              handleMenuClose();
              handleProfileMenuOpen(e);
            }}
          />
        ),
      },
    ];

    const renderMobileMenu = (
      <Menu
        anchorEl={mobileMoreAnchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        id={mobileMenuId}
        keepMounted
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={isMobileMenuOpen}
        onClose={handleMobileMenuClose}
        PaperProps={{
          elevation: 3,
          sx: {
            minWidth: 200,
            mt: 1,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <AppBarActionsMenu
          appBarActions={processAppBarActions(allAppBarActionsMobile, appBarActionsProcessors)}
        />
      </Menu>
    );

    const visibleMobileActions = processAppBarActions(
      allAppBarActionsMobile,
      appBarActionsProcessors
    ).filter(action => React.isValidElement(action.action) || typeof action === 'function');

    return (
      <>
        <AppBar
          position="static"
          elevation={0}
          sx={{
            backgroundImage: 'none',
            zIndex: theme.zIndex.drawer + 1,
            color:
              theme.palette.navbar.color ??
              theme.palette.getContrastText(theme.palette.navbar.background),
            backgroundColor: theme.palette.navbar.background,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
          component="nav"
          aria-label="Top navigation"
        >
          <Toolbar
            sx={{
              minHeight: '56px !important',
              px: { xs: 1, sm: 2 },
              gap: 1,
            }}
          >
            {isSmall ? (
              <>
                <CaravanButton open={openSideBar} onToggleOpen={onToggleOpen} />
                <Box sx={{ flexGrow: 1 }} />
                {visibleMobileActions.length > 0 && (
                  <TopBarIconButton
                    icon="mdi:dots-vertical"
                    tooltip="More options"
                    onClick={handleMobileMenuOpen}
                  />
                )}
              </>
            ) : (
              <>
                {/* Logo Section */}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AppLogo />
                </Box>

                {/* Divider */}
                <Divider
                  orientation="vertical"
                  flexItem
                  sx={{ mx: 1.5, my: 1.5, opacity: 0.3 }}
                />

                {/* Cluster Switcher */}
                <ClusterSwitcher />

                {/* Spacer */}
                <Box sx={{ flexGrow: 1 }} />

                {/* Right Actions */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  {/* Custom app bar actions */}
                  <AppBarActions
                    appBarActions={processAppBarActions(appBarActions, appBarActionsProcessors)}
                  />

                  {/* Global Search */}
                  <GlobalSearch />

                  {/* Settings */}
                  <SettingsButton onClickExtra={handleMenuClose} />

                  {/* User Menu */}
                  {isClusterContext && (
                    <TopBarIconButton
                      icon="mdi:account-circle"
                      tooltip="Account"
                      onClick={handleProfileMenuOpen}
                      active={isMenuOpen}
                    />
                  )}
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
