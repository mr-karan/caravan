import { Icon } from '@iconify/react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface BackLinkProps {
  /** The location to go back to. If not provided, the browser's history will be used. */
  to?: string | ReturnType<typeof useLocation>;
}

export default function BackLink(props: BackLinkProps) {
  const { to: backLink = '' } = props;
  
  const navigate = useNavigate();

  // We only want to update when the backLink changes (not the navigate).
  React.useEffect(() => {}, [backLink]);

  return (
    <Button
      startIcon={<Icon icon="mdi:chevron-left" />}
      size="small"
      sx={theme => ({ color: theme.palette.primaryColor })}
      onClick={() => {
        // If there is no back link, go back in history.
        if (!backLink) {
          navigate(-1);
          return;
        }

        navigate(backLink as string);
      }}
    >
      <Typography style={{ paddingTop: '3px' }}>Back</Typography>
    </Button>
  );
}
