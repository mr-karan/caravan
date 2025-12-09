import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Switch,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import ClearIcon from '@mui/icons-material/Clear';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import { getCluster } from '../../../lib/cluster';
import { getAppUrl } from '../../../helpers/getAppUrl';

interface TaskLogsProps {
  allocId: string;
  taskName: string;
  onClose?: () => void;
}

export default function TaskLogs({ allocId, taskName }: TaskLogsProps) {
  const [logs, setLogs] = useState<string>('');
  const [logType, setLogType] = useState<'stdout' | 'stderr'>('stdout');
  const [isStreaming, setIsStreaming] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoScroll]);

  const startStreaming = useCallback(() => {
    // Abort existing connection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setError(null);

    const cluster = getCluster() || 'default';
    const baseUrl = getAppUrl();
    const params = new URLSearchParams({
      type: logType,
      follow: isStreaming ? 'true' : 'false',
      origin: 'end',
      offset: '50000', // ~50KB of history from the end (like Nomad UI)
    });

    const url = `${baseUrl}api/clusters/${cluster}/v1/allocation/${encodeURIComponent(allocId)}/logs/${encodeURIComponent(taskName)}?${params}`;

    // Create abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Use fetch with ReadableStream - can send credentials and custom headers
    fetch(url, {
      method: 'GET',
      credentials: 'include', // Send cookies cross-origin
      signal: abortController.signal,
      headers: {
        Accept: 'text/event-stream',
      },
    })
      .then(async response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        // Read the stream
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            // SSE format: "data: <content>"
            if (line.startsWith('data: ')) {
              const data = line.slice(6); // Remove "data: " prefix
              setLogs(prev => prev + data + '\n');
              scrollToBottom();
            } else if (line.startsWith('event: error')) {
              // Next data line will contain the error
              continue;
            }
          }
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') {
          // Intentionally aborted, not an error
          return;
        }
        console.error('Log streaming error:', err);
        setError(err.message || 'Connection error');
      });
  }, [allocId, taskName, logType, isStreaming, scrollToBottom]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    if (isStreaming) {
      startStreaming();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isStreaming, logType, startStreaming]);

  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  const handleClear = () => {
    setLogs('');
  };

  const handleDownload = () => {
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${taskName}-${logType}-${new Date().toISOString()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    setLogs('');
    startStreaming();
  };

  const toggleStreaming = () => {
    if (isStreaming) {
      stopStreaming();
    } else {
      setIsStreaming(true);
    }
  };

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar
        variant="dense"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          gap: 1,
          minHeight: 48,
          px: 2,
        }}
      >
        <Select
          size="small"
          value={logType}
          onChange={e => {
            setLogs('');
            setLogType(e.target.value as 'stdout' | 'stderr');
          }}
          sx={{ minWidth: 100 }}
        >
          <MenuItem value="stdout">stdout</MenuItem>
          <MenuItem value="stderr">stderr</MenuItem>
        </Select>

        <Box sx={{ flexGrow: 1 }} />

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
            />
          }
          label="Auto-scroll"
          sx={{ mr: 1 }}
        />

        <Tooltip title={isStreaming ? 'Pause' : 'Resume'}>
          <IconButton size="small" onClick={toggleStreaming}>
            {isStreaming ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Refresh">
          <IconButton size="small" onClick={handleRefresh}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Clear">
          <IconButton size="small" onClick={handleClear}>
            <ClearIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Download">
          <IconButton size="small" onClick={handleDownload}>
            <DownloadIcon />
          </IconButton>
        </Tooltip>
      </Toolbar>

      <Box
        ref={logsContainerRef}
        sx={{
          flexGrow: 1,
          minHeight: 0,
          overflow: 'auto',
          p: 2,
          bgcolor: 'grey.900',
          fontFamily: '"Roboto Mono", "Consolas", "Monaco", monospace',
          fontSize: '0.85rem',
          lineHeight: 1.4,
          whiteSpace: 'pre',
          color: 'grey.100',
        }}
      >
        {error ? (
          <Typography color="error" sx={{ p: 2 }}>
            Error loading logs: {error}
          </Typography>
        ) : logs ? (
          <>
            {logs}
            <div ref={logsEndRef} />
          </>
        ) : (
          <Typography sx={{ color: 'grey.500', fontStyle: 'italic' }}>
            {isStreaming ? 'Waiting for logs...' : 'Logs paused. Click play to resume.'}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
