import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import React from 'react';
import { useNavigate } from 'react-router-dom';

export interface ClusterSelectorProps {
  currentCluster?: string;
  clusters: string[];
}

const ClusterSelector: React.FC<ClusterSelectorProps> = ({ currentCluster = '', clusters }) => {
  const navigate = useNavigate();

  return (
    <FormControl variant="outlined" margin="normal" size="small" sx={{ minWidth: 250 }}>
      <InputLabel id="settings--cluster-selector">Cluster</InputLabel>
      <Select
        labelId="settings--cluster-selector"
        value={currentCluster}
        onChange={event => {
          navigate(`/settings/cluster?c=${event.target.value}`, { replace: true });
        }}
        label="Cluster"
        autoWidth
        aria-label="Cluster selector"
      >
        {clusters.map(clusterName => (
          <MenuItem key={clusterName} value={clusterName}>
            {clusterName}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default ClusterSelector;
