import React from 'react';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  CircularProgress,
  Box,
} from '@mui/material';
import { useNamespace, ALL_NAMESPACES } from '../../lib/nomad/namespaceContext';

interface NamespaceSwitcherProps {
  size?: 'small' | 'medium';
}

export default function NamespaceSwitcher({ size = 'small' }: NamespaceSwitcherProps) {
  
  const { namespace, setNamespace, namespaces, loading } = useNamespace();

  const handleChange = (event: SelectChangeEvent) => {
    setNamespace(event.target.value);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  return (
    <FormControl size={size} sx={{ minWidth: 150 }}>
      <InputLabel id="namespace-select-label">Namespace</InputLabel>
      <Select
        labelId="namespace-select-label"
        id="namespace-select"
        value={namespace}
        label="Namespace"
        onChange={handleChange}
        sx={{
          bgcolor: 'background.paper',
          '& .MuiSelect-select': {
            py: size === 'small' ? 0.75 : 1.5,
          },
        }}
      >
        <MenuItem value={ALL_NAMESPACES}>
          <em>All Namespaces</em>
        </MenuItem>
        {namespaces.map((ns) => (
          <MenuItem key={ns.Name} value={ns.Name}>
            {ns.Name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
