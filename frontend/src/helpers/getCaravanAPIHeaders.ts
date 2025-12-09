/**
 * The backend token to use when making API calls from Caravan when running as an app.
 * The token is requested from the main process via IPC once the renderer is ready,
 * and stored for use in the getCaravanAPIHeaders function below.
 *
 * The app also sets CARAVAN_BACKEND_TOKEN in the caravan-server environment,
 * which the server checks to validate requests containing this same token.
 */
let backendToken: string | null = null;

/**
 * Sets the backend token to use when making API calls from Caravan when running as an app.
 *
 * This is not a Nomad ACL token, but one that protects caravan-server APIs.
 */
export function setBackendToken(token: string | null) {
  backendToken = import.meta.env.REACT_APP_CARAVAN_BACKEND_TOKEN || token;
}

/**
 * Returns headers for making API calls to the caravan-server backend.
 */
export function getCaravanAPIHeaders(): { [key: string]: string } {
  if (backendToken === null) {
    return {};
  }

  return {
    'X-CARAVAN_BACKEND-TOKEN': backendToken,
  };
}
