import React, { useState } from 'react';
import { IconButton, Tooltip, Box, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

interface CopyButtonProps {
  value: string;
  size?: 'small' | 'medium';
  tooltip?: string;
}

/**
 * A simple copy-to-clipboard button that shows a check mark when copied
 */
export function CopyButton({ value, size = 'small', tooltip = 'Copy' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Tooltip title={copied ? 'Copied!' : tooltip}>
      <IconButton size={size} onClick={handleCopy} sx={{ p: 0.25 }}>
        {copied ? (
          <CheckIcon fontSize="small" sx={{ color: 'success.main' }} />
        ) : (
          <ContentCopyIcon fontSize="small" sx={{ opacity: 0.6 }} />
        )}
      </IconButton>
    </Tooltip>
  );
}

interface CopyableTextProps {
  value: string;
  displayValue?: string;
  truncate?: boolean;
  maxWidth?: number | string;
  fontFamily?: string;
}

/**
 * Text with a copy button that appears on hover
 */
export function CopyableText({
  value,
  displayValue,
  truncate = false,
  maxWidth = 'none',
  fontFamily = 'inherit',
}: CopyableTextProps) {
  const [showCopy, setShowCopy] = useState(false);

  return (
    <Box
      display="flex"
      alignItems="center"
      gap={0.5}
      onMouseEnter={() => setShowCopy(true)}
      onMouseLeave={() => setShowCopy(false)}
      sx={{ maxWidth }}
    >
      <Typography
        variant="body2"
        component="span"
        sx={{
          fontFamily,
          overflow: truncate ? 'hidden' : 'visible',
          textOverflow: truncate ? 'ellipsis' : 'clip',
          whiteSpace: truncate ? 'nowrap' : 'normal',
          flex: truncate ? 1 : 'none',
        }}
      >
        {displayValue || value}
      </Typography>
      <Box
        sx={{
          opacity: showCopy ? 1 : 0,
          transition: 'opacity 0.2s',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <CopyButton value={value} />
      </Box>
    </Box>
  );
}

/**
 * A short ID with copy functionality - shows truncated ID with copy button
 */
export function CopyableId({ id, length = 8 }: { id: string; length?: number }) {
  const shortId = id.substring(0, length);
  return <CopyableText value={id} displayValue={shortId} fontFamily="monospace" />;
}

/**
 * An IP address with copy functionality
 */
export function CopyableIP({ ip }: { ip: string }) {
  return <CopyableText value={ip} fontFamily="monospace" />;
}

export default CopyButton;
