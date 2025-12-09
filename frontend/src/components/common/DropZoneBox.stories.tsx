import { InlineIcon } from '@iconify/react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Meta, StoryFn } from '@storybook/react';
import { DropZoneBox } from './DropZoneBox';

export default {
  title: 'DropZoneBox',
  component: DropZoneBox,
} as Meta;

const Template: StoryFn<typeof DropZoneBox> = args => <DropZoneBox {...args} />;

export const UploadFiles = Template.bind({});
UploadFiles.args = {
  children: (
    <>
      <Typography sx={{ m: 2 }}>{'Select a file or drag and drop here'}</Typography>
      <Button
        variant="contained"
        component="label"
        startIcon={<InlineIcon icon="mdi:upload" width={32} />}
        sx={{ fontWeight: 500 }}
      >
        {'Select File'}
      </Button>
    </>
  ),
};
