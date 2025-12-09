import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Grid,
  Link,
  Tab,
  Tabs,
  Typography,
  IconButton,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getNode, getNodeAllocations, setNodeEligibility, drainNode } from '../../../lib/nomad/api';
import { Node, AllocationListStub } from '../../../lib/nomad/types';
import { SectionBox, NameValueTable, SimpleTable } from '../../common';
import { DateLabel } from '../../common/Label';
import { createRouteURL } from '../../../lib/router/createRouteURL';
import { StatusChip } from '../statusStyles';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

interface MainInfoSectionProps {
  title: string;
  resource?: any;
  headerStyle?: string;
  actions?: React.ReactNode[];
}

function MainInfoSection({ title, actions }: MainInfoSectionProps) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 2 }}>
      <Typography variant="h4">{title}</Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {actions}
      </Box>
    </Box>
  );
}

export default function NodeDetails() {
  
  const { id } = useParams<{ id: string }>();
  const [node, setNode] = useState<Node | null>(null);
  const [allocations, setAllocations] = useState<AllocationListStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    loadNode();
  }, [id]);

  async function loadNode() {
    if (!id) return;

    try {
      setLoading(true);
      const [nodeData, allocsData] = await Promise.all([
        getNode(id),
        getNodeAllocations(id).catch(() => []),
      ]);
      setNode(nodeData);
      setAllocations(allocsData || []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleEligibility() {
    if (!node) return;
    try {
      const newEligibility = node.SchedulingEligibility !== 'eligible';
      await setNodeEligibility(node.ID, newEligibility);
      loadNode();
    } catch (err) {
      console.error('Failed to toggle eligibility:', err);
    }
  }

  async function handleDrain() {
    if (!node) return;
    try {
      await drainNode(node.ID, !node.Drain);
      loadNode();
    } catch (err) {
      console.error('Failed to toggle drain:', err);
    }
  }

  if (loading) {
    return <Typography>"Loading..."</Typography>;
  }

  if (error) {
    return <Typography color="error">"Error": {error.message}</Typography>;
  }

  if (!node) {
    return <Typography>"Node not found"</Typography>;
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Format resources for display
  const cpuMHz = node.NodeResources?.Cpu?.CpuShares || 0;
  const memoryMB = node.NodeResources?.Memory?.MemoryMB || 0;
  const diskMB = node.NodeResources?.Disk?.DiskMB || 0;

  return (
    <>
      <MainInfoSection
        title={node.Name}
        resource={node}
        headerStyle="normal"
        actions={[
          <IconButton key="refresh" onClick={loadNode} title="Refresh">
            <RefreshIcon />
          </IconButton>,
          <Button
            key="eligibility"
            onClick={handleToggleEligibility}
            variant="outlined"
            size="small"
            color={node.SchedulingEligibility === 'eligible' ? 'warning' : 'success'}
          >
            {node.SchedulingEligibility === 'eligible' ? 'Mark Ineligible' : 'Mark Eligible'}
          </Button>,
          <Button
            key="drain"
            onClick={handleDrain}
            variant="outlined"
            size="small"
            color={node.Drain ? 'success' : 'warning'}
          >
            {node.Drain ? 'Disable Drain' : 'Enable Drain'}
          </Button>,
        ]}
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Allocations" />
          <Tab label="Attributes" />
          <Tab label="Events" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <SectionBox title="Details">
              <NameValueTable
                rows={[
                  { name: 'ID', value: node.ID },
                  { name: 'Name', value: node.Name },
                  { name: 'Datacenter', value: node.Datacenter },
                  {
                    name: 'Status',
                    value: <StatusChip status={node.Status} />,
                  },
                  {
                    name: 'Scheduling Eligibility',
                    value: (
                      <StatusChip
                        status={node.SchedulingEligibility === 'eligible' ? 'running' : 'ineligible'}
                        label={node.SchedulingEligibility}
                      />
                    ),
                  },
                  {
                    name: 'Drain',
                    value: node.Drain ? 'Yes' : 'No',
                  },
                  { name: 'Node Class', value: node.NodeClass || '-' },
                  { name: 'Address', value: node.HTTPAddr },
                  { name: 'TLS Enabled', value: node.TLSEnabled ? 'Yes' : 'No' },
                ]}
              />
            </SectionBox>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <SectionBox title="Resources">
              <NameValueTable
                rows={[
                  { name: 'CPU', value: `${cpuMHz} MHz` },
                  { name: 'Memory', value: `${memoryMB} MB` },
                  { name: 'Disk', value: `${diskMB} MB` },
                ]}
              />
            </SectionBox>
          </Grid>

          {node.Drivers && Object.keys(node.Drivers).length > 0 && (
            <Grid size={12}>
              <SectionBox title="Drivers">
                <SimpleTable
                  columns={[
                    { label: 'Driver', getter: (driver) => driver.name },
                    {
                      label: 'Detected',
                      getter: (driver) => driver.info.Detected ? 'Yes' : 'No',
                    },
                    {
                      label: 'Healthy',
                      getter: (driver) => driver.info.Healthy ? 'Yes' : 'No',
                    },
                    {
                      label: 'Health Description',
                      getter: (driver) => driver.info.HealthDescription || '-',
                    },
                  ]}
                  data={Object.entries(node.Drivers).map(([name, info]) => ({ name, info }))}
                />
              </SectionBox>
            </Grid>
          )}

          {node.Meta && Object.keys(node.Meta).length > 0 && (
            <Grid size={12}>
              <SectionBox title="Metadata">
                <NameValueTable
                  rows={Object.entries(node.Meta).map(([key, value]) => ({
                    name: key,
                    value: value,
                  }))}
                />
              </SectionBox>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <SectionBox title="Allocations">
          {allocations.length === 0 ? (
            <Typography color="text.secondary">"No allocations on this node"</Typography>
          ) : (
            <SimpleTable
              columns={[
                {
                  label: 'ID',
                  getter: (alloc) => (
                    <Link
                      component={RouterLink}
                      to={createRouteURL('nomadAllocation', { id: alloc.ID })}
                    >
                      {alloc.ID.substring(0, 8)}
                    </Link>
                  ),
                },
                { label: 'Name', getter: (alloc) => alloc.Name },
                {
                  label: 'Job',
                  getter: (alloc) => (
                    <Link
                      component={RouterLink}
                      to={createRouteURL('nomadJob', {
                        namespace: alloc.Namespace || 'default',
                        name: alloc.JobID,
                      })}
                    >
                      {alloc.JobID}
                    </Link>
                  ),
                },
                { label: 'Task Group', getter: (alloc) => alloc.TaskGroup },
                {
                  label: 'Status',
                  getter: (alloc) => <StatusChip status={alloc.ClientStatus} />,
                },
              ]}
              data={allocations}
            />
          )}
        </SectionBox>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <SectionBox title="Attributes">
          {node.Attributes && Object.keys(node.Attributes).length > 0 ? (
            <SimpleTable
              columns={[
                { label: 'Key', getter: (attr) => attr.key },
                { label: 'Value', getter: (attr) => attr.value },
              ]}
              data={Object.entries(node.Attributes)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => ({ key, value }))}
            />
          ) : (
            <Typography color="text.secondary">"No attributes"</Typography>
          )}
        </SectionBox>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <SectionBox title="Events">
          {node.Events && node.Events.length > 0 ? (
            <SimpleTable
              columns={[
                { label: 'Subsystem', getter: (event) => event.Subsystem },
                { label: 'Message', getter: (event) => event.Message },
                {
                  label: 'Time',
                  getter: (event) =>
                    event.Timestamp ? <DateLabel date={new Date(event.Timestamp / 1000000)} /> : '-',
                },
              ]}
              data={[...node.Events].reverse()}
            />
          ) : (
            <Typography color="text.secondary">"No events"</Typography>
          )}
        </SectionBox>
      </TabPanel>
    </>
  );
}
