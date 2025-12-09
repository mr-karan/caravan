import { Box, Typography } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { TestContext } from '../../test'; // Adjust path if necessary for your project structure
import Loader, { LoaderProps } from './Loader'; // Assuming LoaderProps is exported from Loader.tsx

export default {
  title: 'common/Loader', // Updated title to match the 'common' category
  component: Loader,
  decorators: [
    // Added TestContext decorator for consistency, though Loader might not directly need it
    Story => (
      <TestContext>
        <Story />
      </TestContext>
    ),
  ],
  argTypes: {
    title: {
      control: 'text',
      description: 'Title attribute for the CircularProgress, used for accessibility.',
      defaultValue: 'Loading...', // Added a default value for better Storybook control
    },
    noContainer: {
      control: 'boolean',
      description: 'If true, renders only the CircularProgress without a wrapping Box.',
      defaultValue: false,
    },
    size: {
      control: 'number',
      description: 'The size of the loader (CircularProgress).',
      defaultValue: 40, // Default CircularProgress size
    },
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'error', 'info', 'success', 'warning', 'inherit'],
      description: 'The color of the loader.',
      defaultValue: 'primary',
    },
    // You can add other CircularProgressProps here if you want to control them via Storybook
    // e.g., thickness, disableShrink, variant
  },
} as Meta<typeof Loader>;

const Template: StoryFn<LoaderProps> = args => <Loader {...args} />;

export const DefaultWithContainer = Template.bind({});
DefaultWithContainer.args = {
  title: 'Loading data...',
  // noContainer is false by default as per argTypes
};
DefaultWithContainer.storyName = 'Default (With Container)'; // More descriptive name

export const InlineNoContainer = Template.bind({}); // Renamed for clarity
InlineNoContainer.args = {
  title: 'Loading inline...',
  noContainer: true,
};
InlineNoContainer.storyName = 'Inline (No Container)';

export const CustomSize = Template.bind({});
CustomSize.args = {
  title: 'Loading with custom size...',
  size: 80,
};
CustomSize.storyName = 'Custom Size';

export const CustomColor = Template.bind({});
CustomColor.args = {
  title: 'Loading with custom color...',
  color: 'secondary',
};
CustomColor.storyName = 'Custom Color';

// New story: Shows how the loader might be used within another component
export const InsideAComponent = () => (
  <TestContext>
    {' '}
    {/* Ensure TestContext wraps if needed by children or MUI theming */}
    <Box sx={{ border: '1px dashed grey', padding: 2, textAlign: 'center', width: '300px' }}>
      <Typography variant="h6">Some Content Area</Typography>
      <Typography variant="body2" gutterBottom>
        Imagine data is being fetched for this section.
      </Typography>
      <Loader title="Fetching section data..." noContainer={false} size={30} />
      <Typography variant="body2" style={{ marginTop: '1rem' }}>
        More content can be around the loader.
      </Typography>
    </Box>
  </TestContext>
);
InsideAComponent.storyName = 'Used Within Another Component';

export const NoTitleProvided = Template.bind({});
NoTitleProvided.args = {
  title: '', // Explicitly empty to test how it renders
  // noContainer: false (default)
};
NoTitleProvided.storyName = 'With Empty Title';
