import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import EmptyContent from './EmptyContent';

// ... existing code ...
export default {
  title: 'Common/EmptyContent',
  component: EmptyContent,
  argTypes: {
    color: {
      control: 'select',
      options: ['textPrimary', 'textSecondary', 'error', 'warning', 'info', 'success'],
    },
  },
} as Meta;

const Template: StoryFn<typeof EmptyContent> = args => <EmptyContent {...args} />;

export const Default = Template.bind({});
Default.args = {
  children: 'No data to be shown.',
};

export const WithCustomColor = Template.bind({});
WithCustomColor.args = {
  children: 'No data to be shown.',
  color: 'error',
};

export const WithMultipleChildren = Template.bind({});
WithMultipleChildren.args = {
  children: ['No data to be shown.', <div key="custom-element">Custom element</div>],
};

export const Empty = Template.bind({});
Empty.args = {
  children: '',
};
