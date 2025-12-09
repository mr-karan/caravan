import { Icon } from '@iconify/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { styled, useTheme } from '@mui/system';
import React from 'react';
import { useTypedSelector } from '../../redux/hooks';

const VersionIcon = styled(Icon)({
  marginTop: '5px',
  marginRight: '5px',
  marginLeft: '5px',
});

export default function VersionButton() {
  const isSidebarOpen = useTypedSelector(state => state.sidebar.isSidebarOpen);
  const theme = useTheme();

  return (
    <Box
      mx="auto"
      pt=".2em"
      sx={{
        textAlign: 'center',
        '& .MuiButton-label': {
          color: 'sidebarLink.main',
        },
      }}
    >
      <Button
        size="small"
        sx={theme => ({ textTransform: 'none', color: theme.palette.sidebar.color })}
        disabled
      >
        <Box display={isSidebarOpen ? 'flex' : 'block'} alignItems="center">
          <Box>
            <VersionIcon color={theme.palette.sidebar.color} icon="mdi:server" />
          </Box>
          <Box>Nomad</Box>
        </Box>
      </Button>
    </Box>
  );
}
