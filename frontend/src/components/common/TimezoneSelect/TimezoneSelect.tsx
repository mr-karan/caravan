import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import React from 'react';
import spacetime from 'spacetime';

export interface TimezoneSelectorProps {
  initialTimezone?: string;
  onChange: (timezone: string) => void;
  /** The custom ID to be used when this component is inside NameValueTable for ARIA labelledby */
  nameLabelID?: string;
}

export default function TimezoneSelect(props: TimezoneSelectorProps) {
  const { onChange, initialTimezone, nameLabelID } = props;
  const timezoneOptions = React.useMemo(() => {
    const timezoneNames = spacetime.timezones();
    return Object.keys(timezoneNames).map(name => {
      const timezone = spacetime.now(name).timezone();
      return {
        name: timezone.name,
        offset: timezone.current.offset,
      };
    });
  }, []);

  return (
    <Autocomplete
      id="cluster-selector-autocomplete"
      options={timezoneOptions}
      getOptionLabel={option =>
        `(UTC${option.offset >= 0 ? '+' : ''}${option.offset}) ${option.name}`
      }
      disableClearable
      autoComplete
      includeInputInList
      openOnFocus
      renderInput={params => (
        <TextField
          {...params}
          helperText="Timezone"
          size="small"
          variant="outlined"
          inputProps={{
            ...params.inputProps,
            'aria-labelledby': nameLabelID,
          }}
        />
      )}
      onChange={(_ev, value) => onChange(value.name)}
      value={timezoneOptions.find(option => option.name === initialTimezone)}
    />
  );
}
