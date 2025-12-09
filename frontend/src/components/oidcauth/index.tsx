import Typography from '@mui/material/Typography';
import { FunctionComponent, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

//@todo: needs cleanup.

const OIDCAuth: FunctionComponent<{}> = () => {
  const location = useLocation();
  const urlSearchParams = new URLSearchParams(location.search);
  const cluster = urlSearchParams.get('cluster');
  

  useEffect(() => {
    if (cluster) {
      localStorage.setItem('auth_status', 'success');
    }
  }, [cluster]);

  return <Typography color="textPrimary">"Redirecting to main page…"</Typography>;
};

export default OIDCAuth;
