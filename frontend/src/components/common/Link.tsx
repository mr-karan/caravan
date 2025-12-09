import MuiLink, { LinkProps as MuiLinkProps } from '@mui/material/Link';
import React from 'react';
import { Link as RouterLink, LinkProps as RouterLinkProps } from 'react-router-dom';

export interface LinkProps extends MuiLinkProps {
  routeName?: string;
  params?: Record<string, string>;
}

export default function Link(props: LinkProps & Partial<RouterLinkProps>) {
  const { routeName, params, children, ...otherProps } = props;

  if (otherProps.href) {
    return <MuiLink {...otherProps}>{children}</MuiLink>;
  }

  return (
    <MuiLink component={RouterLink} {...(otherProps as any)}>
      {children}
    </MuiLink>
  );
}
