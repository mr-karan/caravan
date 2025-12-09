import { combineReducers } from 'redux';
import themeReducer from '../../components/App/themeSlice';
import actionButtons from '../actionButtonsSlice';
import clusterAction from '../clusterActionSlice';
import clusterProviderReducer from '../clusterProviderSlice';
import configReducer from '../configSlice';
import drawerModeSlice from '../drawerModeSlice';
import filterReducer from '../filterSlice';
import eventCallbackReducer from '../caravanEventSlice';
import overviewChartsReducer from '../overviewChartsSlice';
import projectsReducer from '../projectsSlice';
import routesReducer from '../routesSlice';
import uiReducer from '../uiSlice';
import sidebarReducer from './../../components/Sidebar/sidebarSlice';

const reducers = combineReducers({
  filter: filterReducer,
  ui: uiReducer,
  clusterAction: clusterAction,
  config: configReducer,
  actionButtons: actionButtons,
  theme: themeReducer,
  routes: routesReducer,
  sidebar: sidebarReducer,
  eventCallbackReducer,
  overviewCharts: overviewChartsReducer,
  drawerMode: drawerModeSlice,
  clusterProvider: clusterProviderReducer,
  projects: projectsReducer,
});

export type RootState = ReturnType<typeof reducers>;

export default reducers;
