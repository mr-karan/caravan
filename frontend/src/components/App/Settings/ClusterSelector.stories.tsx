import { createTheme, ThemeProvider } from '@mui/material/styles';
import { configureStore } from '@reduxjs/toolkit';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { Provider } from 'react-redux';
import ClusterSelector, { ClusterSelectorProps } from './ClusterSelector';

const theme = createTheme({
  palette: {
    mode: 'light',
    navbar: {
      background: '#fff',
    },
  },
});

const getMockState = () => ({
  plugins: { loaded: true },
  theme: {
    name: 'light',
    logo: null,
    palette: {
      navbar: {
        background: '#fff',
      },
    },
  },
});

export default {
  title: 'Components/ClusterSelector',
  component: ClusterSelector,
} as Meta<typeof ClusterSelector>;

const Template: StoryFn<ClusterSelectorProps> = args => {
  const store = configureStore({
    reducer: (state = getMockState()) => state,
    preloadedState: getMockState(),
  });

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <ClusterSelector {...args} />
      </ThemeProvider>
    </Provider>
  );
};

export const Default = Template.bind({});
Default.args = {
  currentCluster: 'dev',
  clusters: ['dev', 'staging', 'prod'],
};
