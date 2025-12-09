import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import React from 'react';
import SectionHeader, { SectionHeaderProps } from './SectionHeader';

export interface SectionFilterHeaderProps extends SectionHeaderProps {
  noNamespaceFilter?: boolean;
  noSearch?: boolean;
  preRenderFromFilterActions?: React.ReactNode[];
}

export default function SectionFilterHeader(props: SectionFilterHeaderProps) {
  const {
    noNamespaceFilter = false,
    actions: propsActions = [],
    preRenderFromFilterActions,
    ...headerProps
  } = props;

  let actions: React.ReactNode[] = [];
  if (preRenderFromFilterActions) {
    actions.push(...preRenderFromFilterActions);
  }

  if (!!propsActions) {
    actions = actions.concat(propsActions);
  }

  return (
    <React.Fragment>
      <SectionHeader
        {...headerProps}
        actions={
          actions.length <= 1
            ? actions
            : [
                <Box>
                  <Grid container spacing={1} alignItems="center">
                    {actions.map((action, i) => (
                      <Grid key={i}>
                        {action}
                      </Grid>
                    ))}
                  </Grid>
                </Box>,
              ]
        }
      />
    </React.Fragment>
  );
}
