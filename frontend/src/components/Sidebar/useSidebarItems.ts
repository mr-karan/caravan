import cloneDeep from 'lodash/cloneDeep';
import { useMemo } from 'react';
import { createRouteURL } from '../../lib/router/createRouteURL';
import { useTypedSelector } from '../../redux/hooks';
import { DefaultSidebars, SidebarItemProps } from '.';

/** Iterates over every entry in the list, including children */
const forEachEntry = (items: SidebarItemProps[], cb: (item: SidebarItemProps) => void) => {
  items.forEach(it => {
    cb(it);
    if (it.subList) {
      forEachEntry(it.subList, cb);
    }
  });
};

const sortSidebarItems = (items: SidebarItemProps[]): SidebarItemProps[] => {
  const homeItems = items.filter(({ name }) => name === 'home');
  const otherItems = items
    .filter(({ name }) => name !== 'home')
    .sort((a, b) => {
      const aLabel = ((a.label ?? a.name) + '').toLowerCase();
      const bLabel = ((b.label ?? b.name) + '').toLowerCase();
      return aLabel.localeCompare(bLabel);
    });
  return [...homeItems, ...otherItems].map(item => ({
    ...item,
    subList: item.subList ? sortSidebarItems(item.subList) : undefined,
  }));
};

export const useSidebarItems = (sidebarName: string = DefaultSidebars.IN_CLUSTER) => {
  const clusters = useTypedSelector(state => state.config.clusters) ?? {};
  const settings = useTypedSelector(state => state.config.settings);
  const customSidebarEntries = useTypedSelector(state => state.sidebar.entries);
  const customSidebarFilters = useTypedSelector(state => state.sidebar.filters);
  const shouldShowHomeItem = Object.keys(clusters).length !== 1;
  

  const sidebars = useMemo(() => {
    const homeItems: SidebarItemProps[] = [
      {
        name: 'home',
        icon: shouldShowHomeItem ? 'mdi:home' : 'mdi:hexagon-multiple-outline',
        label: shouldShowHomeItem ? 'Clusters' : 'Cluster',
        url: shouldShowHomeItem
          ? '/clusters'
          : createRouteURL('nomadCluster', { cluster: Object.keys(clusters)[0] }),
        divider: !shouldShowHomeItem,
      },
      {
        name: 'settings',
        icon: 'mdi:cog',
        label: 'Settings',
        url: '/settings/general',
      },
    ];

    // Nomad-specific sidebar items
    const inClusterItems: SidebarItemProps[] = [
      {
        name: 'home',
        icon: 'mdi:home',
        label: 'Clusters',
        url: '/clusters',
        hide: !shouldShowHomeItem,
      },
      {
        name: 'infra',
        label: 'Infra',
        icon: 'mdi:server-outline',
        subList: [
          {
            name: 'nomadNodes',
            label: 'Nodes',
          },
          {
            name: 'nomadNamespaces',
            label: 'Namespaces',
          },
        ],
      },
      {
        name: 'workloads',
        label: 'Workloads',
        icon: 'mdi:circle-slice-2',
        subList: [
          {
            name: 'nomadJobs',
            label: 'Jobs',
          },
          {
            name: 'nomadServices',
            label: 'Services',
          },
          {
            name: 'nomadVariables',
            label: 'Variables',
          },
          {
            name: 'nomadEvaluations',
            label: 'Evaluations',
          },
        ],
      },
      {
        name: 'security',
        label: 'Security',
        icon: 'mdi:shield-key-outline',
        subList: [
          {
            name: 'nomadToken',
            label: 'ACL Token',
          },
        ],
      },
    ];

    // List of sidebars, they act as roots for the sidebar tree
    const sidebarsList: SidebarItemProps[] = [
      { name: DefaultSidebars.HOME, subList: homeItems, label: '' },
      { name: DefaultSidebars.IN_CLUSTER, subList: inClusterItems, label: '' },
    ];

    // Create a copy of all the custom entries so we don't accidentally mutate them
    const customEntries = cloneDeep(Object.values(customSidebarEntries));

    // Lookup map of every sidebar entry
    const entryLookup = new Map<string, SidebarItemProps>();

    // Put all the entries in the map
    forEachEntry(sidebarsList, item => entryLookup.set(item.name, item));
    forEachEntry(customEntries, item => entryLookup.set(item.name, item));

    // Place all custom entries in the tree
    customEntries.forEach(item => {
      if (item.parent) {
        const parentEntry = entryLookup.get(item.parent);
        if (!parentEntry) {
          return;
        }
        parentEntry.subList ??= [];
        parentEntry?.subList?.push(item);
      } else {
        const sidebar = item.sidebar ?? DefaultSidebars.IN_CLUSTER;
        let sidebarEntry = entryLookup.get(sidebar);

        // Create the sidebar entry if it doesn't exist
        if (!sidebarEntry) {
          sidebarEntry = { name: sidebar, subList: [], label: '' };
          sidebarsList.push(sidebarEntry);
          entryLookup.set(sidebar, sidebarEntry);
        }

        sidebarEntry.subList?.push(item);
      }
    });

    const sidebars = Object.fromEntries(sidebarsList.map(item => [item.name, item.subList]));

    // Filter in-cluster sidebar
    if (customSidebarFilters.length > 0) {
      const filterSublist = (item: SidebarItemProps, filter: any) => {
        if (item.subList) {
          item.subList = item.subList.filter(it => filter(it));
          item.subList = item.subList.map(it => filterSublist(it, filter));
        }

        return item;
      };

      customSidebarFilters.forEach(customFilter => {
        sidebars[DefaultSidebars.IN_CLUSTER] = sidebars[DefaultSidebars.IN_CLUSTER]!.filter(it =>
          customFilter(it)
        ).map(it => filterSublist(it, customFilter));
      });
    }

    return sidebars;
  }, [customSidebarEntries, shouldShowHomeItem, Object.keys(clusters).join(',')]);

  const unsortedItems =
    sidebars[sidebarName === '' ? DefaultSidebars.IN_CLUSTER : sidebarName] ?? [];

  const sortedItems = useMemo(() => {
    // Make a deep copy so that we always start from the original (unsorted) order.
    const itemsCopy = cloneDeep(unsortedItems);
    return settings?.sidebarSortAlphabetically ? sortSidebarItems(itemsCopy) : itemsCopy;
  }, [unsortedItems, settings.sidebarSortAlphabetically]);

  return sortedItems;
};
