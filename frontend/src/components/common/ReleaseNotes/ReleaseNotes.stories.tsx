import { Meta, StoryFn } from '@storybook/react';
import { http, HttpResponse } from 'msw';
import ReleaseNotes from './ReleaseNotes';

const withEnv = (Story: React.ComponentType) => {
  localStorage.setItem('app_version', '1.8.0'); // lets notes show for 1.9.9
  localStorage.setItem('disable_update_check', 'false');
  (window as any).desktopApi = {
    receive: (_: string, cb: (cfg: any) => void) =>
      cb({ appVersion: '1.9.9', checkForUpdates: true }),
    send: () => {},
  };
  return <Story />;
};

export default {
  title: 'common/ReleaseNotes/ReleaseNotes',
  component: ReleaseNotes,
  decorators: [withEnv],
  parameters: {
    msw: {
      handlers: [
        http.get('https://api.github.com/repos/kinvolk/caravan/releases', () =>
          HttpResponse.json([
            { name: 'v2.0.0', html_url: 'https://example.com/v2', body: 'big release' },
            { name: 'caravan-plugin-example', html_url: '#', body: '' },
          ])
        ),
        http.get('https://api.github.com/repos/kinvolk/caravan/releases/tags/v1.9.9', () =>
          HttpResponse.json({
            body: '### Hello\n\nworld',
          })
        ),
      ],
    },
  },
} as Meta;

const Template: StoryFn = () => <ReleaseNotes />;

export const Default = Template.bind({});
