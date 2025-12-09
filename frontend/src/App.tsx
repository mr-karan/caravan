import './components/App/icons';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React, { useMemo } from 'react';
import { Provider } from 'react-redux';
import AppContainer from './components/App/AppContainer';
import { useCurrentAppTheme } from './components/App/themeSlice';
import ErrorBoundary from './components/common/ErrorBoundary';
import ErrorComponent from './components/common/ErrorPage';
import { queryClient } from './lib/queryClient';
import { setStore } from './lib/router/createRouteURL';
import { createMuiTheme, getThemeName, usePrefersColorScheme } from './lib/themes';
import { useTypedSelector } from './redux/hooks';
import store from './redux/stores/store';

setStore(store);

function AppWithRedux(props: React.PropsWithChildren<{}>) {
  let themeName = useTypedSelector(state => state.theme.name);
  usePrefersColorScheme();

  if (!themeName) {
    themeName = getThemeName();
  }

  const currentAppTheme = useCurrentAppTheme();
  const muiTheme = useMemo(() => createMuiTheme(currentAppTheme), [themeName, currentAppTheme]);

  return <ThemeProvider theme={muiTheme}>{props.children}</ThemeProvider>;
}

// https://vite.dev/guide/env-and-mode
// if you want to enable the devtools for react-query,
// just set REACT_APP_ENABLE_REACT_QUERY_DEVTOOLS=true in .env file
const queryDevtoolsEnabled = import.meta.env.REACT_APP_ENABLE_REACT_QUERY_DEVTOOLS === 'true';

function App() {
  return (
    <ErrorBoundary fallback={<ErrorComponent />}>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          {queryDevtoolsEnabled && <ReactQueryDevtools initialIsOpen={false} />}

          <AppWithRedux>
            <AppContainer />
          </AppWithRedux>
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;
