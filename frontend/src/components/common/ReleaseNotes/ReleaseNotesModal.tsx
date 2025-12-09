import { Icon } from '@iconify/react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { DialogTitle } from '../Dialog';

export interface ReleaseNotesModalProps {
  releaseNotes: string;
  appVersion: string | null;
}

export default function ReleaseNotesModal(props: ReleaseNotesModalProps) {
  const { releaseNotes, appVersion } = props;
  const [showReleaseNotes, setShowReleaseNotes] = React.useState(Boolean(releaseNotes));

  return (
    <Dialog open={showReleaseNotes} maxWidth="xl">
      <DialogTitle
        buttons={[
          <IconButton aria-label="Close" onClick={() => setShowReleaseNotes(false)}>
            <Icon icon="mdi:close" width="30" height="30" />
          </IconButton>,
        ]}
      >
        {`Release Notes (${appVersion})`}
      </DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            img: {
              display: 'block',
              maxWidth: '100%',
            },
          }}
        >
          <ReactMarkdown
            components={{
              a: ({ children, href }) => {
                return (
                  <Link href={href} target="_blank">
                    {children}
                  </Link>
                );
              },
            }}
          >
            {releaseNotes}
          </ReactMarkdown>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
