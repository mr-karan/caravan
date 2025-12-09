import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import {
  alpha,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import ClusterAvatar from '../common/ClusterAvatar';
import {
  CLUSTER_COLORS,
  CLUSTER_EMOJIS,
  getClusterCustomColor,
  getClusterEmoji,
  getClusterGroup,
  getClusterGroups,
  setClusterCustomColor,
  setClusterEmoji,
  setClusterGroup,
  updateClusterPreferences,
} from '../../lib/clusterPreferences';

interface ClusterCustomizeDialogProps {
  open: boolean;
  clusterName: string;
  onClose: () => void;
}

export default function ClusterCustomizeDialog({
  open,
  clusterName,
  onClose,
}: ClusterCustomizeDialogProps) {
  const theme = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const [customColor, setCustomColorState] = useState<string | undefined>(
    getClusterCustomColor(clusterName)
  );
  const [emoji, setEmojiState] = useState<string | undefined>(getClusterEmoji(clusterName));
  const [group, setGroupState] = useState<string | undefined>(getClusterGroup(clusterName));
  const [customHex, setCustomHex] = useState(customColor || '');

  const groups = getClusterGroups();

  const handleSave = () => {
    setClusterCustomColor(clusterName, customColor);
    setClusterEmoji(clusterName, emoji);
    setClusterGroup(clusterName, group);
    onClose();
  };

  const handleReset = () => {
    setCustomColorState(undefined);
    setEmojiState(undefined);
    setGroupState(undefined);
    setCustomHex('');
  };

  const handleColorSelect = (color: string) => {
    setCustomColorState(color);
    setCustomHex(color);
  };

  const handleEmojiSelect = (selectedEmoji: string) => {
    setEmojiState(selectedEmoji === emoji ? undefined : selectedEmoji);
  };

  const handleCustomHexChange = (value: string) => {
    setCustomHex(value);
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      setCustomColorState(value);
    }
  };

  // Preview component
  const Preview = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        p: 2,
        borderRadius: 2,
        backgroundColor: alpha(theme.palette.primary.main, 0.04),
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        Preview
      </Typography>
      {emoji ? (
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 2,
            backgroundColor: customColor || alpha(theme.palette.primary.main, 0.15),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.75rem',
            boxShadow: theme.shadows[2],
          }}
        >
          {emoji}
        </Box>
      ) : (
        <ClusterAvatar
          name={clusterName}
          size={56}
          sx={{
            borderRadius: 2,
            boxShadow: theme.shadows[2],
            ...(customColor && { bgcolor: customColor }),
          }}
        />
      )}
      <Typography variant="body2" fontWeight={600}>
        {clusterName}
      </Typography>
      {group && (
        <Typography variant="caption" color="text.secondary">
          {groups.find(g => g.id === group)?.name || group}
        </Typography>
      )}
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Icon icon="mdi:palette" width={24} />
        Customize {clusterName}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', gap: 3 }}>
          {/* Left side - Preview */}
          <Box sx={{ width: 140, flexShrink: 0 }}>
            <Preview />
          </Box>

          {/* Right side - Options */}
          <Box sx={{ flex: 1 }}>
            <Tabs
              value={tabIndex}
              onChange={(_, v) => setTabIndex(v)}
              sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Color" />
              <Tab label="Icon" />
              <Tab label="Group" />
            </Tabs>

            {/* Color Tab */}
            {tabIndex === 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Choose a custom color for this cluster
                </Typography>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: 1,
                    mb: 2,
                  }}
                >
                  {CLUSTER_COLORS.map(color => (
                    <Box
                      key={color}
                      onClick={() => handleColorSelect(color)}
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        backgroundColor: color,
                        cursor: 'pointer',
                        border:
                          customColor === color
                            ? `3px solid ${theme.palette.primary.main}`
                            : '3px solid transparent',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          transform: 'scale(1.1)',
                        },
                      }}
                    />
                  ))}
                </Box>

                <TextField
                  size="small"
                  label="Custom hex color"
                  value={customHex}
                  onChange={e => handleCustomHexChange(e.target.value)}
                  placeholder="#FF5722"
                  fullWidth
                  InputProps={{
                    startAdornment: customColor && (
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: 0.5,
                          backgroundColor: customColor,
                          mr: 1,
                        }}
                      />
                    ),
                  }}
                />

                {customColor && (
                  <Button
                    size="small"
                    onClick={() => {
                      setCustomColorState(undefined);
                      setCustomHex('');
                    }}
                    sx={{ mt: 1 }}
                  >
                    Reset to default
                  </Button>
                )}
              </Box>
            )}

            {/* Icon/Emoji Tab */}
            {tabIndex === 1 && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Choose an emoji icon for this cluster
                </Typography>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 0.5,
                    mb: 2,
                  }}
                >
                  {CLUSTER_EMOJIS.map(e => (
                    <Box
                      key={e}
                      onClick={() => handleEmojiSelect(e)}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        backgroundColor:
                          emoji === e
                            ? alpha(theme.palette.primary.main, 0.15)
                            : 'transparent',
                        border:
                          emoji === e
                            ? `2px solid ${theme.palette.primary.main}`
                            : '2px solid transparent',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.08),
                        },
                      }}
                    >
                      {e}
                    </Box>
                  ))}
                </Box>

                <Typography variant="caption" color="text.secondary">
                  Click an emoji to select it, click again to deselect
                </Typography>

                {emoji && (
                  <Button
                    size="small"
                    onClick={() => setEmojiState(undefined)}
                    sx={{ mt: 1, display: 'block' }}
                  >
                    Use default avatar
                  </Button>
                )}
              </Box>
            )}

            {/* Group Tab */}
            {tabIndex === 2 && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Assign this cluster to a group
                </Typography>

                <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                  <InputLabel>Group</InputLabel>
                  <Select
                    value={group || ''}
                    onChange={e => setGroupState(e.target.value || undefined)}
                    label="Group"
                  >
                    <MenuItem value="">
                      <em>No group</em>
                    </MenuItem>
                    {groups.map(g => (
                      <MenuItem key={g.id} value={g.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {g.emoji && <span>{g.emoji}</span>}
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: g.color,
                            }}
                          />
                          {g.name}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Available groups:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {groups.map(g => (
                      <Box
                        key={g.id}
                        onClick={() => setGroupState(g.id)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 1.5,
                          py: 0.75,
                          borderRadius: 2,
                          backgroundColor:
                            group === g.id
                              ? alpha(g.color || theme.palette.primary.main, 0.15)
                              : alpha(theme.palette.text.primary, 0.04),
                          border:
                            group === g.id
                              ? `2px solid ${g.color || theme.palette.primary.main}`
                              : '2px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            backgroundColor: alpha(g.color || theme.palette.primary.main, 0.1),
                          },
                        }}
                      >
                        {g.emoji && <span>{g.emoji}</span>}
                        <Typography variant="body2">{g.name}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleReset} color="inherit">
          Reset All
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

