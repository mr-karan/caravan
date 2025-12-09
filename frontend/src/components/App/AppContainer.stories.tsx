import { Meta, StoryFn } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { Provider } from 'react-redux';
import store from '../../redux/stores/store';
import AppContainer from './AppContainer';

const withEnv = (Story: React.ComponentType) => {
  const prev = (window as any).desktopApi;
  (window as any).desktopApi = {
    send: () => {},
    receive: () => {},
  };

  React.useEffect(() => {
    return () => {
      if (prev === undefined) {
        delete (window as any).desktopApi;
      } else {
        (window as any).desktopApi = prev;
      }
    };
  }, []);

  return (
    <Provider store={store}>
      <Story />
    </Provider>
  );
};

export default {
  title: 'App/AppContainer',
  component: AppContainer,
  decorators: [withEnv],
  parameters: {
    layout: 'fullscreen',
    storyshots: { disable: true },
    docs: {
      description: {
        component:
          'The root container for the Caravan application. It sets up routing, global providers, and the main layout. This story primarily verifies that it renders its children correctly.',
      },
    },
    msw: {
      handlers: [
        http.get('*/plugins', () => HttpResponse.json([])),
        http.get('*/config', () => HttpResponse.json({})),
      ],
    },
  },
} as Meta<typeof AppContainer>;

const Template: StoryFn = args => <AppContainer {...args} />;

export const Default = Template.bind({});
