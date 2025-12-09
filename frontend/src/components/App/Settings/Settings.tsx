import { Icon } from '@iconify/react';
import {
  alpha,
  Box,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Grid,
  Paper,
  Switch,
  Typography,
  useTheme,
} from '@mui/material';
import { capitalize } from 'lodash';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setAppSettings } from '../../../redux/configSlice';
import { defaultTableRowsPerPageOptions } from '../../../redux/configSlice';
import { useTypedSelector } from '../../../redux/hooks';
import { uiSlice } from '../../../redux/uiSlice';
import ActionButton from '../../common/ActionButton';
import SectionBox from '../../common/SectionBox';
import TimezoneSelect from '../../common/TimezoneSelect';
import { setTheme, useAppThemes } from '../themeSlice';
import { useSettings } from './hook';
import NumRowsInput from './NumRowsInput';
import { ThemePreview } from './ThemePreview';

// Setting card component for consistent styling
function SettingCard({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <Card
      elevation={0}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        height: '100%',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon icon={icon} width={22} color={theme.palette.primary.main} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {title}
            </Typography>
            {description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {description}
              </Typography>
            )}
          </Box>
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const theme = useTheme();
  const settingsObj = useSettings();
  const storedTimezone = settingsObj.timezone;
  const storedRowsPerPageOptions = settingsObj.tableRowsPerPageOptions;
  const storedSortSidebar = settingsObj.sidebarSortAlphabetically;
  const [selectedTimezone, setSelectedTimezone] = useState<string>(
    storedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [sortSidebar, setSortSidebar] = useState<boolean>(storedSortSidebar);
  const dispatch = useDispatch();
  const themeName = useTypedSelector(state => state.theme.name);
  const appThemes = useAppThemes();

  useEffect(() => {
    dispatch(
      setAppSettings({
        timezone: selectedTimezone,
      })
    );
  }, [selectedTimezone]);

  useEffect(() => {
    dispatch(
      setAppSettings({
        sidebarSortAlphabetically: sortSidebar,
      })
    );
  }, [sortSidebar]);

  return (
    <Box>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, ${alpha(theme.palette.background.paper, 1)} 100%)`,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon icon="mdi:cog" width={28} color={theme.palette.primary.main} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={600}>
                Settings
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Customize your Caravan experience
              </Typography>
            </Box>
          </Box>
          <ActionButton
            icon="mdi:information-outline"
            description="Version Info"
            onClick={() => {
              dispatch(uiSlice.actions.setVersionDialogOpen(true));
            }}
          />
        </Box>
      </Paper>

      {/* Settings Grid */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <SettingCard
            icon="mdi:table"
            title="Table Rows"
            description="Number of rows to display in tables"
          >
            <NumRowsInput
              defaultValue={storedRowsPerPageOptions || defaultTableRowsPerPageOptions}
              nameLabelID="rows-per-page"
            />
          </SettingCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SettingCard
            icon="mdi:clock-outline"
            title="Timezone"
            description="Timezone for displaying dates and times"
          >
            <TimezoneSelect
              initialTimezone={selectedTimezone}
              onChange={name => setSelectedTimezone(name)}
              nameLabelID="timezone"
            />
          </SettingCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SettingCard
            icon="mdi:sort-alphabetical-ascending"
            title="Sidebar Sorting"
            description="Sort sidebar navigation items alphabetically"
          >
            <FormControlLabel
              control={
                <Switch
                  color="primary"
                  checked={sortSidebar}
                  onChange={e => setSortSidebar(e.target.checked)}
                />
              }
              label={sortSidebar ? 'Enabled' : 'Disabled'}
              sx={{ mt: 1 }}
            />
          </SettingCard>
        </Grid>
      </Grid>

      {/* Theme Section */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon="mdi:palette" width={22} color={theme.palette.primary.main} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Theme
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose your preferred color scheme
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 2,
          }}
        >
          {appThemes.map(it => {
            const isSelected = themeName === it.name;
            return (
              <Box
                key={it.name}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') dispatch(setTheme(it.name));
                }}
                sx={{
                  cursor: 'pointer',
                  border: isSelected ? '2px solid' : '1px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  borderRadius: 2,
                  p: 1.5,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                  backgroundColor: isSelected
                    ? alpha(theme.palette.primary.main, 0.04)
                    : 'transparent',
                  '&:hover': {
                    borderColor: isSelected ? 'primary.main' : 'primary.light',
                    backgroundColor: alpha(theme.palette.primary.main, 0.04),
                  },
                }}
                onClick={() => dispatch(setTheme(it.name))}
              >
                <ThemePreview theme={it} size={100} />
                <Box
                  sx={{
                    mt: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
                    {capitalize(it.name)}
                  </Typography>
                  {isSelected && (
                    <Chip
                      label="Active"
                      size="small"
                      color="primary"
                      sx={{ height: 20, fontSize: '0.65rem' }}
                    />
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
}
