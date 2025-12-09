import { configureStore } from '@reduxjs/toolkit';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { TestContext } from '../../test';
import { AppLogo, AppLogoProps } from './AppLogo';

const getMockState = (themeName: 'light' | 'dark' = 'light', loaded = true, logo: any = null) => ({
  plugins: { loaded },
  theme: {
    logo,
    name: themeName,
    palette: {
      navbar: {
        background: '#fff',
      },
    },
  },
});

export default {
  title: 'App/AppLogo',
  component: AppLogo,
  argTypes: {
    logoType: {
      control: { type: 'radio' },
      options: ['small', 'large'],
    },
    themeName: {
      control: { type: 'radio' },
      options: ['light', 'dark'],
    },
  },
} as Meta<typeof AppLogo>;

const Template: StoryFn<AppLogoProps> = args => {
  const themeName = args.themeName === 'dark' ? 'dark' : 'light';
  const store = configureStore({
    reducer: (state = getMockState(themeName)) => state,
    preloadedState: getMockState(themeName),
  });

  return (
    <TestContext store={store}>
      <AppLogo {...args} />
    </TestContext>
  );
};

export const LargeLight = Template.bind({});
LargeLight.args = {
  logoType: 'large',
  themeName: 'light',
};

export const LargeDark = Template.bind({});
LargeDark.args = {
  logoType: 'large',
  themeName: 'dark',
};

export const SmallLight = Template.bind({});
SmallLight.args = {
  logoType: 'small',
  themeName: 'light',
};

export const SmallDark = Template.bind({});
SmallDark.args = {
  logoType: 'small',
  themeName: 'dark',
};
