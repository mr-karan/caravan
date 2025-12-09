import { Icon } from '@iconify/react';
import { alpha, IconButton, Tooltip, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { createRouteURL } from '../../../lib/router/createRouteURL';

export default function SettingsButton(props: { onClickExtra?: () => void }) {
  const { onClickExtra } = props;
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Tooltip title="Settings">
      <IconButton
        size="small"
        onClick={() => {
          navigate(createRouteURL('settings'));
          onClickExtra?.();
        }}
        sx={{
          width: 36,
          height: 36,
          color: theme.palette.navbar.color ?? theme.palette.text.primary,
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
          },
        }}
      >
        <Icon icon="mdi:cog-outline" width={20} />
      </IconButton>
    </Tooltip>
  );
}
