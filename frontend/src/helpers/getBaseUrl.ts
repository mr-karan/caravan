declare global {
  interface Window {
    /**
     * caravanBaseUrl is used to set the base URL for the app.
     *
     * When caravan is compiled if a baseUrl is set, then it adds this variable to the
     * appropriate base URL from the environment.
     *
     * Read only.
     */
    caravanBaseUrl?: string;
  }
}

/**
 * @returns the baseUrl for the app based on window.caravanBaseUrl or import.meta.env.PUBLIC_URL
 *
 * This could be either '' meaning /, or something like '/caravan'.
 */
export function getBaseUrl(): string {
  let baseUrl = '';
  if (window?.caravanBaseUrl !== undefined) {
    baseUrl = window.caravanBaseUrl;
  } else {
    baseUrl = import.meta.env.PUBLIC_URL ? import.meta.env.PUBLIC_URL : '';
  }

  if (baseUrl === './' || baseUrl === '.' || baseUrl === '/') {
    baseUrl = '';
  }
  return baseUrl;
}
