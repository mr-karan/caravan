import { configureStore } from '@reduxjs/toolkit';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { Provider } from 'react-redux';
import NodeShellSettings from './NodeShellSettings';

const mockClusterName = 'mock-cluster';

localStorage.setItem(
  `clusterSettings-${mockClusterName}`,
  JSON.stringify({
    nodeShellTerminal: {
      isEnabled: true,
      namespace: 'kube-system',
      linuxImage: 'busybox:1.28',
    },
  })
);

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
  title: 'Settings/NodeShellSettings',
  component: NodeShellSettings,
} as Meta<typeof NodeShellSettings>;

const Template: StoryFn<typeof NodeShellSettings> = args => {
  const store = configureStore({
    reducer: (state = getMockState()) => state,
    preloadedState: getMockState(),
  });

  return (
    <Provider store={store}>
      <NodeShellSettings {...args} />
    </Provider>
  );
};

export const Default = Template.bind({});
Default.args = {
  cluster: mockClusterName,
};
