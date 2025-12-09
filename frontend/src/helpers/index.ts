import { loadClusterSettings, storeClusterSettings } from './clusterSettings';
import { getBaseUrl } from './getBaseUrl';
import { getCaravanAPIHeaders } from './getCaravanAPIHeaders';
import { getProductName, getVersion } from './getProductInfo';
import { isDevMode } from './isDevMode';
import { isDockerDesktop } from './isDockerDesktop';
import { getTablesRowsPerPage, setTablesRowsPerPage } from './tablesRowsPerPage';

const exportFunctions = {
  getBaseUrl,
  isDevMode,
  isDockerDesktop,
  getTablesRowsPerPage,
  setTablesRowsPerPage,
  getVersion,
  getProductName,
  storeClusterSettings,
  loadClusterSettings,
  getCaravanAPIHeaders,
};

export default exportFunctions;
