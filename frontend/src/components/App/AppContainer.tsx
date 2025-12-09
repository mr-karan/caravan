import GlobalStyles from '@mui/material/GlobalStyles';
import { SnackbarProvider } from 'notistack';
import React, { useEffect } from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { getBaseUrl } from '../../helpers/getBaseUrl';
import { NamespaceProvider } from '../../lib/nomad/namespaceContext';
import ReleaseNotes from '../common/ReleaseNotes/ReleaseNotes';
import Layout from './Layout';
import { PreviousRouteProvider } from './RouteSwitcher';

/**
 * Validates if a redirect path is safe to use
 * @param redirectPath - The path to validate
 * @returns true if the path is safe, false otherwise
 */
export const isValidRedirectPath = (redirectPath: string): boolean => {
  // Reject empty or null paths
  if (!redirectPath || redirectPath.trim() === '') {
    return false;
  }

  // Reject paths that start with dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'ftp:'];
  const lowerPath = redirectPath.toLowerCase();
  if (dangerousProtocols.some(protocol => lowerPath.startsWith(protocol))) {
    return false;
  }

  // Reject absolute URLs (external redirects)
  if (redirectPath.startsWith('http://') || redirectPath.startsWith('https://')) {
    return false;
  }

  // Reject protocol-relative URLs (//example.com)
  if (redirectPath.startsWith('//')) {
    return false;
  }

  // Allow relative paths that start with / or are relative paths
  // This ensures we only allow internal navigation
  return true;
};

/**
 * QueryParamRedirect is a component that checks for a 'to' query parameter and redirects accordingly
 * This should be placed near the top of your component hierarchy,
 * typically in your main App component
 * @returns null - This component doesn't render anything visible
 */
const QueryParamRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Get the current URL search params
    const searchParams = new URLSearchParams(location.search);

    // Check if 'to' parameter exists
    const redirectPath = searchParams.get('to');

    if (redirectPath) {
      // Validate the redirect path for security
      if (!isValidRedirectPath(redirectPath)) {
        console.warn('QueryParamRedirect: Invalid redirect path blocked:', redirectPath);
        return;
      }

      // Create a new URLSearchParams without the 'to' parameter
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('to');

      // Construct the new URL without the 'to' parameter
      const newSearch = newSearchParams.toString();
      const newPathWithSearch = redirectPath + (newSearch ? `?${newSearch}` : '');

      // Perform the redirect
      navigate(newPathWithSearch, { replace: true });
    }
  }, [location.search, navigate]);

  return null;
};
export default function AppContainer() {
  return (
    <SnackbarProvider
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
    >
      <GlobalStyles
        styles={{
          ':root': {
            '@media (prefers-reduced-motion: reduce)': {
              '& *': {
                animationDuration: '0.01ms !important',
                animationIterationCount: '1 !important',
                transitionDuration: '0.01ms !important',
                scrollBehavior: 'auto !important',
              },
            },
          },
        }}
      />
      <BrowserRouter basename={getBaseUrl()}>
        <PreviousRouteProvider>
          <NamespaceProvider>
            <Layout />
            <QueryParamRedirect />
          </NamespaceProvider>
        </PreviousRouteProvider>
      </BrowserRouter>
      <ReleaseNotes />
    </SnackbarProvider>
  );
}
