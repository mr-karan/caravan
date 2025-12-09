import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography, { TypographyProps } from '@mui/material/Typography';
import React from 'react';

type Variant = TypographyProps['variant'];

export type HeaderStyle = 'main' | 'subsection' | 'normal' | 'label';

export interface SectionHeaderProps {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  actions?: React.ReactNode[] | null;
  noPadding?: boolean;
  headerStyle?: HeaderStyle;
  titleSideActions?: React.ReactNode[];
}

export default function SectionHeader(props: SectionHeaderProps) {
  const { noPadding = false, headerStyle = 'main', titleSideActions = [] } = props;
  const actions = props.actions || [];
  const titleVariants: { [key: string]: Variant } = {
    main: 'h1',
    subsection: 'h2',
    normal: 'h3',
    label: 'h4',
  };

  return (
    <Grid
      container
      alignItems="center"
      justifyContent="space-between"
      sx={theme => ({
        padding: theme.spacing(noPadding ? 0 : 2),
        paddingTop: theme.spacing(noPadding ? 0 : 3),
      })}
      spacing={2}
    >
      <Grid>
        {(!!props.title || titleSideActions.length > 0) && (
          <Box display="flex" alignItems="center">
            {!!props.title && (
              <Typography
                variant={titleVariants[headerStyle]}
                noWrap
                sx={theme => ({
                  ...theme.palette.headerStyle[headerStyle || 'normal'],
                  whiteSpace: 'pre-wrap',
                })}
              >
                {props.title}
              </Typography>
            )}
            {!!titleSideActions && (
              <Box ml={1} justifyContent="center">
                {titleSideActions.map((action, i) => (
                  <React.Fragment key={i}>{action}</React.Fragment>
                ))}
              </Box>
            )}
          </Box>
        )}
        {!!props.subtitle && (
          <Typography variant="h6" component="p" sx={{ fontStyle: 'italic' }}>
            {props.subtitle}
          </Typography>
        )}
      </Grid>
      {actions.length > 0 && (
        <Grid>
          <Grid
            container
            alignItems="center"
            justifyContent="flex-end"
            sx={{ minHeight: '40px' }}
          >
            {actions.map((action, i) => (
              <Grid key={i}>
                {action}
              </Grid>
            ))}
          </Grid>
        </Grid>
      )}
    </Grid>
  );
}
