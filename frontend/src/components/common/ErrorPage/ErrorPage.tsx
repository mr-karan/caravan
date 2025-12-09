import { Icon } from '@iconify/react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/system';
import { useSnackbar } from 'notistack';
import React from 'react';
import caravanBrokenImage from '../../../assets/caravan-broken.svg';
import { getVersion } from '../../../helpers/getProductInfo';

const WidthImg = styled('img')({
  width: '100%',
  maxWidth: '200px',
  height: 'auto',
});

export interface ErrorComponentProps {
  /** The main title to display. By default it is: "Uh-oh! Something went wrong." */
  title?: React.ReactNode;
  /** The message to display. By default it is: "Head back <a href="..."> home</a>." */
  message?: React.ReactNode;
  /** The graphic or element to display as a main graphic. If used as a string, it will be
   * used as the source for displaying an image. By default it is "caravan-broken.svg". */
  graphic?: React.ReactNode;
  /** Whether to use Typography or not. By default it is true. */
  withTypography?: boolean;
  /** The error object to display. */
  error?: Error;
}

const MAX_STACK_LENGTH = 1000;
const MAX_TITLE_LENGTH = 100;
const GITHUB_REPO_URL = 'https://github.com/kubernetes-sigs/caravan';

function handleOpenGitHubIssue(
  error: Error,
  enqueueSnackbar: (
    message: string,
    options?: { variant?: 'success' | 'error' | 'warning' | 'info' }
  ) => void
) {
  const version = getVersion();

  // Truncate stack trace to prevent URL length limits
  const truncatedStack =
    error.stack && error.stack.length > MAX_STACK_LENGTH
      ? error.stack.substring(0, MAX_STACK_LENGTH) + '\n... (truncated)'
      : error.stack || 'No stack trace available';

  // Sanitize error message in issue title
  const sanitizedMessage = (error.message || 'Application Error')
    .replace(/[\r\n]+/g, ' ') // Replace newlines with spaces
    .substring(0, MAX_TITLE_LENGTH); // Limit title length

  const issueTitle = encodeURIComponent(`Crash Report: ${sanitizedMessage}`);
  const issueBody = encodeURIComponent(
    `## Crash Summary\n${error.message || 'An error occurred in the application'}\n\n` +
      `## Error Stack\n\`\`\`\n${truncatedStack}\n\`\`\`\n\n` +
      `## Caravan Version\n${version.VERSION || 'Unknown'}\n\n` +
      `## Git Commit\n${version.GIT_VERSION || 'Unknown'}\n\n` +
      `## System Information\n` +
      `- User Agent: ${navigator.userAgent}\n` +
      `- Platform: ${navigator.platform}\n` +
      `- Language: ${navigator.language}\n\n` +
      `## Additional Context\n<!-- Please add any additional context about the crash here -->`
  );
  const githubUrl = `${GITHUB_REPO_URL}/issues/new?title=${issueTitle}&body=${issueBody}&labels=kind/bug`;

  // Handle popup blocker - window.open returns null if blocked
  const newWindow = window.open(githubUrl, '_blank');
  if (!newWindow) {
    enqueueSnackbar(
      'Unable to open GitHub. Please check your popup blocker settings or copy the error details manually.',
      { variant: 'warning' }
    );
  }
}

export default function ErrorComponent(props: ErrorComponentProps) {
  
  const { enqueueSnackbar } = useSnackbar();
  const {
    title = 'Uh-oh! Something went wrong.',
    message = '',
    withTypography = true,
    // In vite caravanBrokenImage is a string, but in webpack it is an object
    // TODO: Remove this once we migrate plugins to vite
    graphic = caravanBrokenImage as any as string,
    error,
  } = props;
  return (
    <Grid
      container
      spacing={0}
      direction="column"
      alignItems="center"
      justifyContent="center"
      sx={{ textAlign: 'center' }}
    >
      <Grid size={12}>
        {typeof graphic === 'string' ? <WidthImg src={graphic} alt="" /> : graphic}
        {withTypography ? (
          <Typography variant="h1" sx={{ fontSize: '2.125rem', lineHeight: 1.2, fontWeight: 400 }}>
            {title}
          </Typography>
        ) : (
          title
        )}
        {withTypography ? (
          <Typography variant="h2" sx={{ fontSize: '1.25rem', lineHeight: 3.6, fontWeight: 500 }}>
            {!!message ? (
              message
            ) : (
                <>
                Head back <Link href="/">home</Link>.
              </>
            )}
          </Typography>
        ) : (
          message
        )}
      </Grid>
      {!!error?.stack && (
        <Grid size={12}>
          <Box
            sx={{
              width: '100%',
              maxWidth: 800,
            }}
          >
            <Accordion>
              <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" />}>
                <Typography>"Error Details"</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box display="flex" justifyContent="flex-end" gap={1}>
                  <Button
                    onClick={() => {
                      navigator.clipboard
                        .writeText(error.stack || '')
                        .then(() => {
                          enqueueSnackbar('Copied to clipboard', {
                            variant: 'success',
                          });
                        })
                        .catch(() => {
                          enqueueSnackbar('Failed to copy to clipboard', {
                            variant: 'error',
                          });
                        });
                    }}
                  >
                    "Copy"
                  </Button>
                  <Button
                    color="primary"
                    onClick={() => handleOpenGitHubIssue(error, enqueueSnackbar)}
                  >
                    "Open Issue on GitHub"
                  </Button>
                </Box>
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{
                    textWrapMode: 'wrap',
                    textAlign: 'left',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {error.stack}
                </Typography>
              </AccordionDetails>
            </Accordion>
          </Box>
        </Grid>
      )}
    </Grid>
  );
}
