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
  useTheme,
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

// Configuration for log buffer
const MAX_LOG_LINES = 2000; // Maximum lines to keep in memory
const MAX_DISPLAY_LINES = 500; // Lines to render at once (for performance)
const SCROLL_THROTTLE_MS = 100; // Throttle scroll-to-bottom
const BATCH_UPDATE_MS = 50; // Batch log updates every 50ms

export default function TaskLogs({ allocId, taskName }: TaskLogsProps) {
  const theme = useTheme();
  const [logType, setLogType] = useState<'stdout' | 'stderr'>('stdout');
  const [isStreaming, setIsStreaming] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lineCount, setLineCount] = useState(0);
  
  // Refs for performance - avoid React re-renders
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logContentRef = useRef<HTMLPreElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Log buffer - kept outside React state for performance
  const logBufferRef = useRef<string[]>([]);
  const pendingLogsRef = useRef<string[]>([]);
  const lastScrollTimeRef = useRef<number>(0);
  const batchUpdateTimerRef = useRef<number | null>(null);
  const isUserScrollingRef = useRef(false);
  const fullLogHistoryRef = useRef<string[]>([]); // For download

  // Throttled scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (!autoScroll || isUserScrollingRef.current) return;
    
    const now = Date.now();
    if (now - lastScrollTimeRef.current < SCROLL_THROTTLE_MS) return;
    lastScrollTimeRef.current = now;

    const container = logsContainerRef.current;
    if (container) {
      // Use scrollTop directly instead of scrollIntoView for better performance
      container.scrollTop = container.scrollHeight;
    }
  }, [autoScroll]);

  // Update DOM directly for better performance
  const updateLogDisplay = useCallback(() => {
    const logContent = logContentRef.current;
    if (!logContent) return;

    // Get last N lines for display
    const displayLines = logBufferRef.current.slice(-MAX_DISPLAY_LINES);
    logContent.textContent = displayLines.join('\n');
    
    // Update line count for UI (throttled via batch updates)
    setLineCount(logBufferRef.current.length);
    
    // Schedule scroll
    requestAnimationFrame(scrollToBottom);
  }, [scrollToBottom]);

  // Batch process pending logs
  const processPendingLogs = useCallback(() => {
    if (pendingLogsRef.current.length === 0) return;

    // Process all pending logs
    const newLines = pendingLogsRef.current;
    pendingLogsRef.current = [];

    // Add to buffer
    logBufferRef.current.push(...newLines);
    fullLogHistoryRef.current.push(...newLines);

    // Trim buffer if too large
    if (logBufferRef.current.length > MAX_LOG_LINES) {
      logBufferRef.current = logBufferRef.current.slice(-MAX_LOG_LINES);
    }

    // Update display
    updateLogDisplay();
  }, [updateLogDisplay]);

  // Schedule batch update
  const scheduleUpdate = useCallback(() => {
    if (batchUpdateTimerRef.current !== null) return;
    
    batchUpdateTimerRef.current = window.setTimeout(() => {
      batchUpdateTimerRef.current = null;
      processPendingLogs();
    }, BATCH_UPDATE_MS);
  }, [processPendingLogs]);

  // Add log line (called frequently from stream)
  const addLogLine = useCallback((line: string) => {
    pendingLogsRef.current.push(line);
    scheduleUpdate();
  }, [scheduleUpdate]);

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
      offset: '50000', // ~50KB of history from the end
    });

    const url = `${baseUrl}api/clusters/${cluster}/v1/allocation/${encodeURIComponent(allocId)}/logs/${encodeURIComponent(taskName)}?${params}`;

    // Create abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    fetch(url, {
      method: 'GET',
      credentials: 'include',
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

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              // Split data into individual log lines
              const logLines = data.split('\n');
              for (const logLine of logLines) {
                if (logLine) {
                  addLogLine(logLine);
                }
              }
            }
          }
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') {
          return;
        }
        console.error('Log streaming error:', err);
        setError(err.message || 'Connection error');
      });
  }, [allocId, taskName, logType, isStreaming, addLogLine]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Handle user scroll detection
  const handleScroll = useCallback(() => {
    const container = logsContainerRef.current;
    if (!container) return;

    // Check if user has scrolled away from bottom
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    isUserScrollingRef.current = !isAtBottom;
    
    // If user scrolled to bottom, re-enable auto-scroll
    if (isAtBottom && !autoScroll) {
      // Don't auto-enable, let user control it
    }
  }, [autoScroll]);

  useEffect(() => {
    if (isStreaming) {
      startStreaming();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (batchUpdateTimerRef.current) {
        clearTimeout(batchUpdateTimerRef.current);
      }
    };
  }, [isStreaming, logType, startStreaming]);

  const handleClear = useCallback(() => {
    logBufferRef.current = [];
    pendingLogsRef.current = [];
    fullLogHistoryRef.current = [];
    if (logContentRef.current) {
      logContentRef.current.textContent = '';
    }
    setLineCount(0);
  }, []);

  const handleDownload = useCallback(() => {
    // Use full history for download
    const content = fullLogHistoryRef.current.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${taskName}-${logType}-${new Date().toISOString()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }, [taskName, logType]);

  const handleRefresh = useCallback(() => {
    handleClear();
    startStreaming();
  }, [handleClear, startStreaming]);

  const toggleStreaming = useCallback(() => {
    if (isStreaming) {
      stopStreaming();
    } else {
      setIsStreaming(true);
    }
  }, [isStreaming, stopStreaming]);

  const isDark = theme.palette.mode === 'dark';

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
          flexShrink: 0,
        }}
      >
        <Select
          size="small"
          value={logType}
          onChange={e => {
            handleClear();
            setLogType(e.target.value as 'stdout' | 'stderr');
          }}
          sx={{ minWidth: 100 }}
        >
          <MenuItem value="stdout">stdout</MenuItem>
          <MenuItem value="stderr">stderr</MenuItem>
        </Select>

        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          {lineCount > 0 && `${lineCount.toLocaleString()} lines`}
          {lineCount > MAX_DISPLAY_LINES && ` (showing last ${MAX_DISPLAY_LINES})`}
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={autoScroll}
              onChange={e => {
                setAutoScroll(e.target.checked);
                if (e.target.checked) {
                  isUserScrollingRef.current = false;
                  scrollToBottom();
                }
              }}
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

        <Tooltip title="Download all logs">
          <IconButton size="small" onClick={handleDownload}>
            <DownloadIcon />
          </IconButton>
        </Tooltip>
      </Toolbar>

      <Box
        ref={logsContainerRef}
        onScroll={handleScroll}
        sx={{
          flexGrow: 1,
          minHeight: 0,
          overflow: 'auto',
          bgcolor: isDark ? '#0d1117' : '#1e1e1e',
          position: 'relative',
        }}
      >
        {error && (
          <Typography color="error" sx={{ p: 2 }}>
            Error loading logs: {error}
          </Typography>
        )}
        {!error && lineCount === 0 && (
          <Box sx={{ p: 2 }}>
            <Typography
              sx={{
                color: isDark ? '#8b949e' : '#6a737d',
                fontStyle: 'italic',
                fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
                fontSize: '0.8rem',
              }}
            >
              {isStreaming ? 'Waiting for logs...' : 'Logs paused. Click play to resume.'}
            </Typography>
          </Box>
        )}
        {/* Always render pre element but hide when empty - avoid React reconciliation issues */}
        <Box
          component="pre"
          ref={logContentRef}
          sx={{
            m: 0,
            p: 2,
            fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            color: isDark ? '#e6edf3' : '#d4d4d4',
            minHeight: lineCount > 0 ? '100%' : 0,
            display: lineCount > 0 ? 'block' : 'none',
            // Performance: use GPU acceleration
            transform: 'translateZ(0)',
          }}
        />
      </Box>
    </Paper>
  );
}
