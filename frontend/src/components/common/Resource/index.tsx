import Grid from '@mui/material/Grid';
import React from 'react';

export interface PageGridProps {
  children: React.ReactNode;
}

export function PageGrid({ children }: PageGridProps) {
  return (
    <Grid container spacing={1} justifyContent="flex-start" alignItems="stretch">
      {children}
    </Grid>
  );
}
