import React, { useCallback, useEffect, useState } from 'react';
import {
  alpha,
  Box,
  Breadcrumbs,
  CircularProgress,
  IconButton,
  Link,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { Icon } from '@iconify/react';
import { listAllocFiles, readAllocFile } from '../../../lib/nomad/api';
import { AllocFileInfo } from '../../../lib/nomad/types';
import { DateLabel } from '../../common/Label';

interface FileBrowserProps {
  allocId: string;
  taskName?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(file: AllocFileInfo): string {
  if (file.IsDir) {
    return 'mdi:folder';
  }

  const ext = file.Name.split('.').pop()?.toLowerCase() || '';

  // Config files
  if (['json', 'yaml', 'yml', 'toml', 'ini', 'conf', 'cfg'].includes(ext)) {
    return 'mdi:file-cog';
  }

  // Code files
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'rb', 'php'].includes(ext)) {
    return 'mdi:file-code';
  }

  // Text/document files
  if (['txt', 'md', 'rst', 'doc', 'docx', 'pdf'].includes(ext)) {
    return 'mdi:file-document';
  }

  // Log files
  if (['log', 'out', 'err'].includes(ext) || file.Name.includes('log')) {
    return 'mdi:file-document-outline';
  }

  // Shell/scripts
  if (['sh', 'bash', 'zsh', 'fish'].includes(ext)) {
    return 'mdi:file-code';
  }

  // Archive files
  if (['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar'].includes(ext)) {
    return 'mdi:file-cabinet';
  }

  // Image files
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) {
    return 'mdi:file-image';
  }

  // Binary/executable
  if (['exe', 'bin', 'so', 'dylib', 'dll'].includes(ext) || file.FileMode.startsWith('-rwx')) {
    return 'mdi:file-cog-outline';
  }

  return 'mdi:file-outline';
}

function isTextFile(file: AllocFileInfo): boolean {
  const ext = file.Name.split('.').pop()?.toLowerCase() || '';
  const textExtensions = [
    'txt', 'md', 'rst', 'json', 'yaml', 'yml', 'toml', 'ini', 'conf', 'cfg',
    'js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'rb', 'php',
    'sh', 'bash', 'zsh', 'fish', 'log', 'out', 'err', 'xml', 'html', 'css', 'scss',
    'sql', 'env', 'tmpl', 'tpl', 'hcl', 'tf', 'nomad', 'service', 'socket', 'timer',
  ];

  // Check file extension
  if (textExtensions.includes(ext)) {
    return true;
  }

  // Check file name patterns
  if (file.Name.includes('log') || file.Name.includes('config') || file.Name.startsWith('.')) {
    return true;
  }

  // Check if file size is reasonable for text (< 5MB)
  if (file.Size < 5 * 1024 * 1024) {
    // Could be text, allow attempting to read
    return true;
  }

  return false;
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    rb: 'ruby',
    php: 'php',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    md: 'markdown',
    hcl: 'hcl',
    tf: 'hcl',
    nomad: 'hcl',
  };
  return langMap[ext] || 'plaintext';
}

export default function FileBrowser({ allocId, taskName }: FileBrowserProps) {
  const theme = useTheme();
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<AllocFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // File viewer state
  const [selectedFile, setSelectedFile] = useState<AllocFileInfo | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      // Prepend task name to path if provided
      const fullPath = taskName ? `${taskName}${path}` : path;
      const fileList = await listAllocFiles(allocId, fullPath);
      // Sort: directories first, then alphabetically
      const sorted = [...fileList].sort((a, b) => {
        if (a.IsDir && !b.IsDir) return -1;
        if (!a.IsDir && b.IsDir) return 1;
        return a.Name.localeCompare(b.Name);
      });
      setFiles(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [allocId, taskName]);

  const loadFileContent = useCallback(async (file: AllocFileInfo, path: string) => {
    setFileLoading(true);
    setFileError(null);
    setFileContent(null);
    try {
      const fullPath = taskName
        ? `${taskName}${path}/${file.Name}`
        : `${path === '/' ? '' : path}/${file.Name}`;
      const content = await readAllocFile(allocId, fullPath);
      setFileContent(content);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setFileLoading(false);
    }
  }, [allocId, taskName]);

  // Reset path and file viewer when task or allocation changes
  useEffect(() => {
    setCurrentPath('/');
    setSelectedFile(null);
    setFileContent(null);
    setFileError(null);
  }, [allocId, taskName]);

  useEffect(() => {
    loadFiles(currentPath);
  }, [loadFiles, currentPath]);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    setSelectedFile(null);
    setFileContent(null);
    setFileError(null);
  };

  const handleFileClick = (file: AllocFileInfo) => {
    if (file.IsDir) {
      const newPath = currentPath === '/' ? `/${file.Name}` : `${currentPath}/${file.Name}`;
      handleNavigate(newPath);
    } else if (isTextFile(file)) {
      setSelectedFile(file);
      loadFileContent(file, currentPath);
    }
  };

  const handleCloseFile = () => {
    setSelectedFile(null);
    setFileContent(null);
    setFileError(null);
  };

  // Parse path for breadcrumbs
  const pathParts = currentPath.split('/').filter(Boolean);
  const breadcrumbs = [
    { label: taskName || 'root', path: '/' },
    ...pathParts.map((part, index) => ({
      label: part,
      path: '/' + pathParts.slice(0, index + 1).join('/'),
    })),
  ];

  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar with breadcrumbs */}
      <Toolbar
        variant="dense"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          minHeight: 40,
          px: 1.5,
          gap: 1,
        }}
      >
        <Tooltip title="Go back">
          <span>
            <IconButton
              size="small"
              onClick={() => {
                if (pathParts.length > 0) {
                  handleNavigate('/' + pathParts.slice(0, -1).join('/') || '/');
                }
              }}
              disabled={currentPath === '/'}
              sx={{ p: 0.5 }}
            >
              <Icon icon="mdi:arrow-left" width={18} />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Refresh">
          <IconButton size="small" onClick={() => loadFiles(currentPath)} sx={{ p: 0.5 }}>
            <Icon icon="mdi:refresh" width={18} />
          </IconButton>
        </Tooltip>

        <Box sx={{ width: 1, height: 20, borderLeft: `1px solid ${theme.palette.divider}`, mx: 0.5 }} />

        <Breadcrumbs
          separator={<Icon icon="mdi:chevron-right" width={16} color={theme.palette.text.disabled} />}
          sx={{ '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' } }}
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return isLast ? (
              <Typography
                key={crumb.path}
                variant="caption"
                sx={{ fontWeight: 500, color: 'text.primary', fontSize: '0.8rem' }}
              >
                {crumb.label}
              </Typography>
            ) : (
              <Link
                key={crumb.path}
                component="button"
                variant="caption"
                onClick={() => handleNavigate(crumb.path)}
                sx={{
                  fontSize: '0.8rem',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {crumb.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      </Toolbar>

      {/* Main content */}
      <Box sx={{ display: 'flex', flexGrow: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* File list */}
        <Box
          sx={{
            width: selectedFile ? '40%' : '100%',
            minWidth: selectedFile ? 300 : 'auto',
            borderRight: selectedFile ? `1px solid ${theme.palette.divider}` : 'none',
            overflow: 'auto',
            transition: 'width 0.2s ease',
          }}
        >
          {loading ? (
            <Box sx={{ p: 2 }}>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} variant="rectangular" height={36} sx={{ mb: 1, borderRadius: 1 }} />
              ))}
            </Box>
          ) : error ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Icon icon="mdi:alert-circle" width={36} color={theme.palette.error.main} />
              <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                {error}
              </Typography>
            </Box>
          ) : files.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Icon icon="mdi:folder-open-outline" width={36} color={theme.palette.text.disabled} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Empty directory
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ py: 0.75, fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500 }}>
                      Name
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ py: 0.75, fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500, width: 80 }}
                    >
                      Size
                    </TableCell>
                    <TableCell
                      sx={{ py: 0.75, fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500, width: 80 }}
                    >
                      Mode
                    </TableCell>
                    <TableCell
                      sx={{ py: 0.75, fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500, width: 140 }}
                    >
                      Modified
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {files.map(file => {
                    const isSelected = selectedFile?.Name === file.Name;
                    const canOpen = file.IsDir || isTextFile(file);

                    return (
                      <TableRow
                        key={file.Name}
                        onClick={() => canOpen && handleFileClick(file)}
                        sx={{
                          cursor: canOpen ? 'pointer' : 'default',
                          backgroundColor: isSelected
                            ? alpha(theme.palette.primary.main, 0.08)
                            : 'transparent',
                          '&:hover': {
                            backgroundColor: canOpen
                              ? alpha(theme.palette.primary.main, 0.04)
                              : 'transparent',
                          },
                        }}
                      >
                        <TableCell sx={{ py: 0.75 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Icon
                              icon={getFileIcon(file)}
                              width={18}
                              color={
                                file.IsDir
                                  ? theme.palette.primary.main
                                  : theme.palette.text.secondary
                              }
                            />
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.8rem',
                                fontWeight: file.IsDir ? 500 : 400,
                                color: canOpen ? 'text.primary' : 'text.disabled',
                              }}
                            >
                              {file.Name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 0.75 }}>
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
                          >
                            {file.IsDir ? '—' : formatFileSize(file.Size)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.75 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.7rem',
                              color: 'text.disabled',
                            }}
                          >
                            {file.FileMode}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.75 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                            <DateLabel date={new Date(file.ModTime)} format="mini" />
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>

        {/* File content viewer */}
        {selectedFile && (
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* File header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1.5,
                py: 1,
                borderBottom: `1px solid ${theme.palette.divider}`,
                backgroundColor: alpha(theme.palette.background.default, 0.5),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Icon icon={getFileIcon(selectedFile)} width={18} color={theme.palette.text.secondary} />
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                  {selectedFile.Name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  ({formatFileSize(selectedFile.Size)})
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Tooltip title="Download">
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (fileContent) {
                        const blob = new Blob([fileContent], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = selectedFile.Name;
                        a.click();
                        URL.revokeObjectURL(url);
                      }
                    }}
                    disabled={!fileContent}
                    sx={{ p: 0.5 }}
                  >
                    <Icon icon="mdi:download" width={18} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Close">
                  <IconButton size="small" onClick={handleCloseFile} sx={{ p: 0.5 }}>
                    <Icon icon="mdi:close" width={18} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* File content */}
            <Box
              sx={{
                flexGrow: 1,
                overflow: 'auto',
                backgroundColor: isDark ? '#0d1117' : '#1e1e1e',
              }}
            >
              {fileLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : fileError ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Icon icon="mdi:alert-circle" width={36} color={theme.palette.error.main} />
                  <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                    {fileError}
                  </Typography>
                </Box>
              ) : fileContent !== null ? (
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 2,
                    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
                    fontSize: '0.8rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    color: isDark ? '#e6edf3' : '#d4d4d4',
                  }}
                >
                  {fileContent}
                </Box>
              ) : null}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

