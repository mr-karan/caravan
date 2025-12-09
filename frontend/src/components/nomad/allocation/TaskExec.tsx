import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Box, Paper, Typography, IconButton, Tooltip, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { execInAllocation } from '../../../lib/nomad/api';
import { getCluster } from '../../../lib/cluster';
import '@xterm/xterm/css/xterm.css';

interface TaskExecProps {
  allocId: string;
  taskName: string;
  command?: string[];
  onClose?: () => void;
}

// Backend WebSocket message types
interface ExecMessage {
  type: 'stdout' | 'stderr' | 'exit' | 'error';
  data?: string;
  exitCode?: number;
  error?: string;
}

export default function TaskExec({ allocId, taskName, command = ['/bin/sh'], onClose }: TaskExecProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Send data to WebSocket - backend expects {"type": "stdin", "data": "..."}
  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stdin', data }));
    }
  }, []);

  // Send resize event - backend expects {"type": "resize", "data": {"width": N, "height": N}}
  const sendResize = useCallback((cols: number, rows: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'resize',
        data: { width: cols, height: rows }
      }));
    }
  }, []);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Fira Code", "Monaco", "Menlo", "Ubuntu Mono", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1e1e1e',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);

    // Fit terminal to container
    setTimeout(() => {
      fitAddon.fit();
    }, 0);

    terminalInstance.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle user input
    terminal.onData((data) => {
      sendInput(data);
    });

    // Handle resize
    terminal.onResize(({ cols, rows }) => {
      sendResize(cols, rows);
    });

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
      terminalInstance.current = null;
      fitAddonRef.current = null;
    };
  }, [sendInput, sendResize]);

  // Connect WebSocket - only connect once when component mounts
  useEffect(() => {
    if (!terminalInstance.current) return;

    // Prevent multiple connections
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    const terminal = terminalInstance.current;
    terminal.writeln(`\x1b[33mConnecting to ${taskName}...\x1b[0m`);

    let ws: WebSocket | null = null;
    let isCleanedUp = false;

    try {
      // Create command string for connection (use a stable reference)
      const commandStr = Array.isArray(command) ? command.join(' ') : command;
      const commandArray = Array.isArray(command) ? command : [command || '/bin/sh'];
      
      // Get cluster name for logging
      const clusterName = getCluster();
      console.log('Creating WebSocket connection:', {
        allocId,
        taskName,
        command: commandStr,
        cluster: clusterName,
      });
      
      ws = execInAllocation(allocId, taskName, commandArray, true);
      wsRef.current = ws;
      
      console.log('WebSocket created, URL:', ws.url);

      ws.onopen = () => {
        if (isCleanedUp) {
          ws?.close();
          return;
        }
        setIsConnected(true);
        setIsConnecting(false);
        terminal.writeln(`\x1b[32mConnected. Running: ${commandStr}\x1b[0m`);
        terminal.writeln('');

        // Send initial resize after a short delay to ensure connection is ready
        setTimeout(() => {
          if (fitAddonRef.current && ws?.readyState === WebSocket.OPEN) {
            fitAddonRef.current.fit();
            const dims = fitAddonRef.current.proposeDimensions();
            if (dims) {
              sendResize(dims.cols, dims.rows);
            }
          }
        }, 100);
      };

      ws.onmessage = (event) => {
        if (isCleanedUp) return;

        try {
          const msg: ExecMessage = JSON.parse(event.data);

          switch (msg.type) {
            case 'stdout':
              if (msg.data) {
                terminal.write(msg.data);
              }
              break;
            case 'stderr':
              if (msg.data) {
                terminal.write(`\x1b[31m${msg.data}\x1b[0m`);
              }
              break;
            case 'exit':
              terminal.writeln('');
              terminal.writeln(`\x1b[33mProcess exited with code: ${msg.exitCode ?? 0}\x1b[0m`);
              setIsConnected(false);
              setIsConnecting(false);
              // Don't close WebSocket immediately, let it close naturally
              break;
            case 'error':
              terminal.writeln('');
              terminal.writeln(`\x1b[31mError: ${msg.error}\x1b[0m`);
              setIsConnected(false);
              setIsConnecting(false);
              break;
          }
        } catch (err) {
          // If it's not JSON, write it directly (raw output)
          terminal.write(event.data);
        }
      };

      ws.onerror = (event) => {
        if (isCleanedUp) return;
        
        // Log more details about the error
        const errorMsg = ws?.readyState === WebSocket.CLOSED 
          ? 'WebSocket connection closed unexpectedly'
          : 'WebSocket connection error';
        
        console.error('WebSocket error:', {
          event,
          readyState: ws?.readyState,
          url: ws?.url,
        });
        
        setError(errorMsg);
        setIsConnecting(false);
        terminal.writeln(`\x1b[31m${errorMsg}\x1b[0m`);
      };

      ws.onclose = (event) => {
        if (isCleanedUp) return;
        
        setIsConnected(false);
        setIsConnecting(false);
        
        // Only show error message if it wasn't a normal closure
        if (event.code !== 1000 && event.code !== 1001) {
          const closeReason = event.reason || `code: ${event.code}`;
          terminal.writeln(`\x1b[31mConnection closed unexpectedly (${closeReason})\x1b[0m`);
          setError(`Connection closed: ${closeReason}`);
        } else if (event.code === 1000) {
          terminal.writeln('\x1b[33mConnection closed\x1b[0m');
        }
        
        wsRef.current = null;
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect';
      setError(errorMsg);
      setIsConnecting(false);
      terminal.writeln(`\x1b[31mFailed to connect: ${errorMsg}\x1b[0m`);
    }

    return () => {
      isCleanedUp = true;
      if (wsRef.current) {
        // Close with normal closure code
        if (wsRef.current.readyState === WebSocket.OPEN || 
            wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close(1000, 'Component unmounting');
        }
        wsRef.current = null;
      }
    };
    // Only depend on allocId and taskName - command should be stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocId, taskName]);

  // Focus terminal when clicking on container
  const handleContainerClick = () => {
    terminalInstance.current?.focus();
  };

  return (
    <Paper
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 400,
        bgcolor: '#1e1e1e',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          bgcolor: '#2d2d2d',
          borderBottom: '1px solid #404040',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: '#d4d4d4', fontFamily: 'monospace' }}>
            {taskName}
          </Typography>
          {isConnecting && (
            <CircularProgress size={14} sx={{ color: '#f5f543' }} />
          )}
          {isConnected && (
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: '#0dbc79',
              }}
            />
          )}
          {!isConnected && !isConnecting && (
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: '#cd3131',
              }}
            />
          )}
        </Box>
        {onClose && (
          <Tooltip title="Close terminal">
            <IconButton
              size="small"
              onClick={onClose}
              sx={{ color: '#d4d4d4', '&:hover': { color: '#ffffff' } }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Terminal container */}
      <Box
        ref={terminalRef}
        onClick={handleContainerClick}
        sx={{
          flexGrow: 1,
          p: 1,
          '& .xterm': {
            height: '100%',
          },
          '& .xterm-viewport': {
            overflow: 'hidden !important',
          },
        }}
      />

      {/* Status bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 0.5,
          bgcolor: '#2d2d2d',
          borderTop: '1px solid #404040',
        }}
      >
        <Typography variant="caption" sx={{ color: '#808080', fontFamily: 'monospace' }}>
          {command.join(' ')}
        </Typography>
        <Typography variant="caption" sx={{ color: '#808080', fontFamily: 'monospace' }}>
          {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
        </Typography>
      </Box>
    </Paper>
  );
}
