import { Meta, StoryFn } from '@storybook/react';
import { DateLabel as DateLabelComponent, DateLabelProps } from '../Label';

export default {
  title: 'Label/DateLabel',
  component: DateLabelComponent,
  argTypes: {},
} as Meta;

const Template: StoryFn<DateLabelProps> = args => <DateLabelComponent {...args} />;

const fixedDate = new Date('2021-01-01T00:00:00Z');

export const Default = Template.bind({});
Default.args = {
  date: fixedDate,
};

export const MiniLabel = Template.bind({});
MiniLabel.args = {
  date: fixedDate,
  format: 'mini',
};
