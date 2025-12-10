import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import cloneDeep from 'lodash/cloneDeep';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { generatePath, useLocation, useNavigate } from 'react-router-dom';
import { encodeClusterName, getCluster, getClusterPrefixedPath } from '../../lib/cluster';
import { getRoute } from '../../lib/router';
import { createRouteURL } from '../../lib/router/createRouteURL';
import { useTypedSelector } from '../../redux/hooks';
import Tabs from '../common/Tabs';
import { SidebarItemProps } from '../Sidebar';
import { getFullURLOnRoute } from './SidebarItem';
import { useSidebarItems } from './useSidebarItems';

function searchNameInSubList(sublist: SidebarItemProps['subList'], name: string): boolean {
  if (!sublist) {
    return false;
  }
  for (let i = 0; i < sublist.length; i++) {
    if (sublist[i].name === name) {
      return true;
    }
    if (
      sublist[i].isCR &&
      sublist[i].name.startsWith('group-') &&
      searchNameInSubList(sublist[i].subList, name)
    ) {
      return true;
    }
  }
  return false;
}

function findIndexNameInSubList(sublist: SidebarItemProps['subList'], name: string | null): number {
  if (!name) {
    return -1;
  }
  if (!sublist) {
    return -1;
  }
  for (let i = 0; i < sublist.length; i++) {
    if (sublist[i].name === name) {
      return i;
    }
    if (
      sublist[i].isCR &&
      sublist[i].name.startsWith('group-') &&
      searchNameInSubList(sublist[i].subList, name)
    ) {
      return i;
    }
  }
  return -1;
}

function findParentOfSubList(
  list: SidebarItemProps[],
  name: string | null
): SidebarItemProps | null {
  if (!name) {
    return null;
  }

  let parent = null;
  for (let i = 0; i < list.length; i++) {
    if (searchNameInSubList(list[i].subList, name)) {
      parent = list[i];
    }
  }
  return parent;
}

function findIndexParentOfSubList(list: SidebarItemProps[], name: string | null): number {
  if (!name) {
    return -1;
  }

  for (let i = 0; i < list.length; i++) {
    const k = findIndexNameInSubList(list[i].subList, name);
    if (k !== -1) {
      return k;
    }
  }
  return -1;
}

// todo open second level tabs on reload

export default function NavigationTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const sidebar = useTypedSelector(state => state.sidebar);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('xs'));
  const isSmallSideBar = useMediaQuery(theme.breakpoints.only('sm'));
  
  // Get current cluster from URL - used in handlers below
  const currentCluster = getCluster(location.pathname);
  
  const [secondLevelSidebarItems, setSecondLevelTabRoutes] = useState<SidebarItemProps[]>([]);

  const listItemsOriginal = useSidebarItems(sidebar.selected.sidebar ?? undefined);
  const [navigationItem, subList] = useMemo(() => {
    // Making a copy because we're going to mutate it later in here
    const listItems = cloneDeep(listItemsOriginal);

    let item = listItems.find(item => item.name === sidebar.selected.item);
    if (!item) {
      const parent = findParentOfSubList(listItems, sidebar.selected.item);
      if (!parent) {
        return [null, []];
      }
      item = parent;
    }
    const list = item.subList;

    if (!list) {
      return [null, null];
    }

    if (getRoute(item.name)) {
      list.unshift(item);
    }

    return [item, list];
  }, [listItemsOriginal, sidebar]);

  useEffect(() => {
    if (!subList) {
      return;
    }

    const index = findIndexNameInSubList(subList, sidebar.selected.item) ?? null;
    if (index === undefined || index === null || index === -1) {
      return;
    }

    if (getRoute(navigationItem?.name ?? '') && index === 0) {
      setSecondLevelTabRoutes([]);
    } else if (
      subList[index] !== undefined &&
      subList[index].subList !== undefined &&
      subList[index].subList.length !== 0
    ) {
      setSecondLevelTabRoutes(subList[index].subList);
    } else {
      setSecondLevelTabRoutes([]);
    }
  }, [subList, navigationItem, sidebar.selected.item]);

  const tabChangeHandler = useCallback(
    (index: number) => {
      if (subList === undefined || subList === null) {
        return;
      }
      if (getRoute(navigationItem?.name ?? '') && index === 0) {
        setSecondLevelTabRoutes([]);
      } else if (subList[index].subList !== undefined && subList[index].subList.length !== 0) {
        setSecondLevelTabRoutes(subList[index].subList);
      } else {
        setSecondLevelTabRoutes([]);
      }

      const item = subList[index];
      if (item.url && item.useClusterURL && currentCluster) {
        navigate(generatePath(getClusterPrefixedPath(item.url), { cluster: encodeClusterName(currentCluster) }));
      } else if (item.url) {
        navigate(item.url);
      } else {
        navigate(getFullURLOnRoute(item.name, item.isCR, item.subList ?? []));
      }
    },
    [setSecondLevelTabRoutes, subList, navigationItem, navigate, currentCluster]
  );

  const tabSecondLevelChangeHandler = useCallback(
    (index: number) => {
      if (!secondLevelSidebarItems || secondLevelSidebarItems.length === 0) {
        return;
      }
      const url = secondLevelSidebarItems[index].url;
      const useClusterURL = !!secondLevelSidebarItems[index].useClusterURL;
      if (url && useClusterURL && currentCluster) {
        navigate(generatePath(getClusterPrefixedPath(url), { cluster: encodeClusterName(currentCluster) }));
      } else if (url) {
        navigate(url);
      } else {
        if (secondLevelSidebarItems[index].isCR) {
          navigate(
            createRouteURL('customresources', {
              crd: secondLevelSidebarItems[index].name,
            })
          );
        } else {
          navigate(createRouteURL(secondLevelSidebarItems[index].name));
        }
      }
    },
    [secondLevelSidebarItems, navigate, currentCluster]
  );

  // Always show the navigation tabs when the sidebar is the small version
  if (!isSmallSideBar && (sidebar.isSidebarOpen || isMobile)) {
    return null;
  }

  if (!subList) {
    return null;
  }

  const tabRoutes = subList
    .filter(item => !item.hide)
    .map((item: SidebarItemProps) => {
      return { label: item.label, component: <></> };
    });

  const defaultIndex = findIndexParentOfSubList(subList, sidebar.selected.item) ?? null;
  const secondLevelIndex =
    secondLevelSidebarItems.findIndex(item => item.name === sidebar.selected.item) ?? null;

  const secondLevelTabRoutes = secondLevelSidebarItems
    ?.filter(item => !item.hide)
    ?.map((item: SidebarItemProps) => {
      return { label: item.label, component: <></> };
    });
  return (
    <Box mb={2} component="nav" aria-label="Main Navigation">
      <Tabs
        tabs={tabRoutes}
        onTabChanged={index => {
          tabChangeHandler(index);
        }}
        defaultIndex={defaultIndex !== -1 ? defaultIndex : 0}
        sx={{
          maxWidth: '85vw',
          [theme.breakpoints.down('sm')]: {
            paddingTop: theme.spacing(1),
          },
        }}
        ariaLabel="Navigation Tabs"
      />
      <Divider />
      {secondLevelTabRoutes !== undefined && secondLevelTabRoutes.length !== 0 && (
        <>
          <Tabs
            tabs={secondLevelTabRoutes!!}
            defaultIndex={secondLevelIndex !== -1 ? secondLevelIndex : 0}
            onTabChanged={index => {
              tabSecondLevelChangeHandler(index);
            }}
            ariaLabel="Navigation Tabs"
          />
          <Divider />
        </>
      )}
    </Box>
  );
}
