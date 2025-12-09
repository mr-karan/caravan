import { getBaseUrl } from './getBaseUrl';
import { isDevMode } from './isDevMode';
import { isDockerDesktop } from './isDockerDesktop';

/**
 * @returns URL depending on dev-mode/docker desktop, base-url, and window.location.origin.
 *
 * @example isDevMode returns 'http://localhost:4466/'
 * @example isDockerDesktop returns 'http://localhost:64446/'
 * @example base-url set as '/caravan' returns '/caravan/'
 * @example isDevMode and base-url is set returns 'http://localhost:4466/caravan/'
 * @example returns 'https://caravan.example.com/' using the window.location.origin of browser
 *
 */
export function getAppUrl(): string {
  let url = '';
  let backendPort = 4466;
  let useLocalhost = false;

  if (isDevMode()) {
    useLocalhost = true;
  }

  if (isDockerDesktop()) {
    backendPort = 64446;
    useLocalhost = true;
  }

  if (useLocalhost) {
    url = `http://localhost:${backendPort}`;
  } else {
    url = window.location.origin;
  }

  const baseUrl = getBaseUrl();
  url += baseUrl ? baseUrl + '/' : '/';

  return url;
}
