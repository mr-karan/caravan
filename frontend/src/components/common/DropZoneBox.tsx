import Box from '@mui/material/Box';
import { styled } from '@mui/system';

export const DropZoneBox = styled(Box)({
  border: 1,
  borderRadius: 1,
  borderWidth: 2,
  borderColor: 'rgba(0, 0, 0)',
  borderStyle: 'dashed',
  padding: '20px',
  margin: '20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  '&:hover': {
    borderColor: 'rgba(0, 0, 0, 0.5)',
  },
  '&:focus-within': {
    borderColor: 'rgba(0, 0, 0, 0.5)',
  },
});

export default DropZoneBox;
