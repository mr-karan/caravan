// Base types for Nomad resources

export interface NomadMetadata {
  CreateIndex: number;
  ModifyIndex: number;
}

// Job types
export interface Job {
  ID: string;
  ParentID?: string;
  Name: string;
  Namespace: string;
  Type: 'service' | 'batch' | 'system' | 'sysbatch';
  Priority: number;
  Periodic?: PeriodicConfig;
  ParameterizedJob?: ParameterizedJobConfig;
  Stop?: boolean;
  Status: 'pending' | 'running' | 'dead';
  StatusDescription?: string;
  Stable?: boolean;
  Datacenters: string[];
  TaskGroups: TaskGroup[];
  Update?: UpdateStrategy;
  Constraints?: Constraint[];
  Affinities?: Affinity[];
  Spreads?: Spread[];
  Meta?: Record<string, string>;
  CreateIndex: number;
  ModifyIndex: number;
  JobModifyIndex: number;
  SubmitTime?: number;
  Version?: number;
}

export interface JobListStub {
  ID: string;
  ParentID?: string;
  Name: string;
  Namespace: string;
  Datacenters: string[];
  Type: string;
  Priority: number;
  Periodic: boolean;
  ParameterizedJob: boolean;
  Stop: boolean;
  Status: string;
  StatusDescription?: string;
  JobSummary?: JobSummary;
  CreateIndex: number;
  ModifyIndex: number;
  JobModifyIndex: number;
  SubmitTime?: number;
}

export interface JobSummary {
  JobID: string;
  Namespace: string;
  Summary: Record<string, TaskGroupSummary>;
  Children?: JobChildrenSummary;
  CreateIndex: number;
  ModifyIndex: number;
}

export interface TaskGroupSummary {
  Queued: number;
  Complete: number;
  Failed: number;
  Running: number;
  Starting: number;
  Lost: number;
  Unknown: number;
}

export interface JobChildrenSummary {
  Pending: number;
  Running: number;
  Dead: number;
}

export interface PeriodicConfig {
  Enabled: boolean;
  Spec: string;
  SpecType: string;
  ProhibitOverlap: boolean;
  TimeZone: string;
}

export interface ParameterizedJobConfig {
  Payload: string;
  MetaRequired?: string[];
  MetaOptional?: string[];
}

export interface UpdateStrategy {
  Stagger: number;
  MaxParallel: number;
  HealthCheck: string;
  MinHealthyTime: number;
  HealthyDeadline: number;
  ProgressDeadline: number;
  AutoRevert: boolean;
  AutoPromote: boolean;
  Canary: number;
}

export interface Constraint {
  LTarget: string;
  RTarget: string;
  Operand: string;
}

export interface Affinity {
  LTarget: string;
  RTarget: string;
  Operand: string;
  Weight: number;
}

export interface Spread {
  Attribute: string;
  Weight: number;
  SpreadTarget: SpreadTarget[];
}

export interface SpreadTarget {
  Value: string;
  Percent: number;
}

// Task Group types
export interface TaskGroup {
  Name: string;
  Count: number;
  Tasks: Task[];
  Constraints?: Constraint[];
  Affinities?: Affinity[];
  Spreads?: Spread[];
  Networks?: NetworkResource[];
  Services?: Service[];
  Volumes?: Record<string, VolumeRequest>;
  RestartPolicy?: RestartPolicy;
  ReschedulePolicy?: ReschedulePolicy;
  EphemeralDisk?: EphemeralDisk;
  Update?: UpdateStrategy;
  Migrate?: MigrateStrategy;
  Scaling?: ScalingPolicy;
  Meta?: Record<string, string>;
}

export interface Task {
  Name: string;
  Driver: string;
  User?: string;
  Config: Record<string, any>;
  Constraints?: Constraint[];
  Affinities?: Affinity[];
  Env?: Record<string, string>;
  Services?: Service[];
  Resources: Resources;
  Meta?: Record<string, string>;
  KillTimeout?: number;
  LogConfig?: LogConfig;
  Artifacts?: TaskArtifact[];
  Vault?: Vault;
  Templates?: Template[];
  DispatchPayload?: DispatchPayloadConfig;
  Leader?: boolean;
  ShutdownDelay?: number;
  KillSignal?: string;
  Kind?: string;
  ScalingPolicies?: ScalingPolicy[];
}

export interface Resources {
  CPU?: number;
  MemoryMB?: number;
  MemoryMaxMB?: number;
  DiskMB?: number;
  Networks?: NetworkResource[];
  Devices?: RequestedDevice[];
}

export interface NetworkResource {
  Mode?: string;
  Device?: string;
  CIDR?: string;
  IP?: string;
  MBits?: number;
  DNS?: DNSConfig;
  ReservedPorts?: Port[];
  DynamicPorts?: Port[];
}

export interface DNSConfig {
  Servers?: string[];
  Searches?: string[];
  Options?: string[];
}

export interface Port {
  Label: string;
  Value?: number;
  To?: number;
  HostNetwork?: string;
}

export interface RequestedDevice {
  Name: string;
  Count?: number;
  Constraints?: Constraint[];
  Affinities?: Affinity[];
}

export interface Service {
  Name: string;
  TaskName?: string;
  PortLabel: string;
  AddressMode?: string;
  Address?: string;
  EnableTagOverride?: boolean;
  Tags?: string[];
  CanaryTags?: string[];
  Checks?: ServiceCheck[];
  CheckRestart?: CheckRestart;
  Connect?: ConsulConnect;
  Meta?: Record<string, string>;
  CanaryMeta?: Record<string, string>;
  OnUpdate?: string;
  Provider?: string;
}

export interface ServiceCheck {
  Name: string;
  Type: string;
  Command?: string;
  Args?: string[];
  Path?: string;
  Protocol?: string;
  PortLabel?: string;
  Expose?: boolean;
  AddressMode?: string;
  Interval?: number;
  Timeout?: number;
  InitialStatus?: string;
  TLSSkipVerify?: boolean;
  Method?: string;
  Header?: Record<string, string[]>;
  CheckRestart?: CheckRestart;
  GRPCService?: string;
  GRPCUseTLS?: boolean;
  TaskName?: string;
  SuccessBeforePassing?: number;
  FailuresBeforeCritical?: number;
  Body?: string;
  OnUpdate?: string;
}

export interface CheckRestart {
  Limit: number;
  Grace: number;
  IgnoreWarnings: boolean;
}

export interface ConsulConnect {
  Native?: boolean;
  Gateway?: ConsulGateway;
  SidecarService?: ConsulSidecarService;
  SidecarTask?: SidecarTask;
}

export interface ConsulGateway {
  Proxy?: ConsulGatewayProxy;
  Ingress?: ConsulIngressConfigEntry;
  Terminating?: ConsulTerminatingConfigEntry;
  Mesh?: ConsulMeshConfigEntry;
}

export interface ConsulGatewayProxy {}
export interface ConsulIngressConfigEntry {}
export interface ConsulTerminatingConfigEntry {}
export interface ConsulMeshConfigEntry {}
export interface ConsulSidecarService {}
export interface SidecarTask {}

export interface VolumeRequest {
  Name: string;
  Type: string;
  Source: string;
  ReadOnly?: boolean;
  MountOptions?: CSIMountOptions;
  PerAlloc?: boolean;
}

export interface CSIMountOptions {
  FSType?: string;
  MountFlags?: string[];
}

export interface RestartPolicy {
  Attempts: number;
  Interval: number;
  Delay: number;
  Mode: string;
}

export interface ReschedulePolicy {
  Attempts?: number;
  Interval?: number;
  Delay?: number;
  DelayFunction?: string;
  MaxDelay?: number;
  Unlimited?: boolean;
}

export interface EphemeralDisk {
  Sticky?: boolean;
  SizeMB?: number;
  Migrate?: boolean;
}

export interface MigrateStrategy {
  MaxParallel: number;
  HealthCheck: string;
  MinHealthyTime: number;
  HealthyDeadline: number;
}

export interface ScalingPolicy {
  ID?: string;
  Namespace?: string;
  Target?: Record<string, string>;
  Min?: number;
  Max?: number;
  Policy?: Record<string, any>;
  Enabled?: boolean;
  Type?: string;
  CreateIndex?: number;
  ModifyIndex?: number;
}

export interface LogConfig {
  MaxFiles: number;
  MaxFileSizeMB: number;
}

export interface TaskArtifact {
  GetterSource: string;
  GetterOptions?: Record<string, string>;
  GetterHeaders?: Record<string, string>;
  GetterMode?: string;
  RelativeDest: string;
}

export interface Vault {
  Policies?: string[];
  Namespace?: string;
  Env?: boolean;
  ChangeMode?: string;
  ChangeSignal?: string;
}

export interface Template {
  SourcePath?: string;
  DestPath: string;
  EmbeddedTmpl?: string;
  ChangeMode?: string;
  ChangeSignal?: string;
  Splay?: number;
  Perms?: string;
  LeftDelim?: string;
  RightDelim?: string;
  Envvars?: boolean;
  VaultGrace?: number;
  Wait?: WaitConfig;
}

export interface WaitConfig {
  Min: number;
  Max: number;
}

export interface DispatchPayloadConfig {
  File: string;
}

// Allocation types
export interface Allocation {
  ID: string;
  Namespace: string;
  EvalID: string;
  Name: string;
  NodeID: string;
  NodeName: string;
  JobID: string;
  Job?: Job;
  TaskGroup: string;
  Resources?: Resources;
  TaskResources?: Record<string, Resources>;
  AllocatedResources?: AllocatedResources;
  Services?: Record<string, string>;
  Metrics?: AllocationMetric;
  DesiredStatus: 'run' | 'stop' | 'evict';
  DesiredDescription?: string;
  DesiredTransition?: DesiredTransition;
  ClientStatus: 'pending' | 'running' | 'complete' | 'failed' | 'lost' | 'unknown';
  ClientDescription?: string;
  TaskStates?: Record<string, TaskState>;
  DeploymentID?: string;
  DeploymentStatus?: DeploymentStatus;
  FollowupEvalID?: string;
  PreviousAllocation?: string;
  NextAllocation?: string;
  RescheduleTracker?: RescheduleTracker;
  PreemptedAllocations?: string[];
  PreemptedByAllocation?: string;
  CreateIndex: number;
  ModifyIndex: number;
  AllocModifyIndex: number;
  CreateTime: number;
  ModifyTime: number;
}

export interface AllocationListStub {
  ID: string;
  EvalID: string;
  Name: string;
  Namespace: string;
  NodeID: string;
  NodeName: string;
  JobID: string;
  JobType: string;
  JobVersion: number;
  TaskGroup: string;
  AllocatedResources?: AllocatedResources;
  DesiredStatus: string;
  DesiredDescription?: string;
  ClientStatus: string;
  ClientDescription?: string;
  TaskStates?: Record<string, TaskState>;
  DeploymentStatus?: DeploymentStatus;
  FollowupEvalID?: string;
  RescheduleTracker?: RescheduleTracker;
  PreemptedAllocations?: string[];
  PreemptedByAllocation?: string;
  CreateIndex: number;
  ModifyIndex: number;
  CreateTime: number;
  ModifyTime: number;
}

export interface AllocatedResources {
  Tasks?: Record<string, AllocatedTaskResources>;
  TaskLifecycles?: Record<string, TaskLifecycle>;
  Shared?: AllocatedSharedResources;
}

export interface AllocatedTaskResources {
  Cpu?: AllocatedCpuResources;
  Memory?: AllocatedMemoryResources;
  Networks?: NetworkResource[];
  Devices?: AllocatedDeviceResource[];
}

export interface AllocatedCpuResources {
  CpuShares: number;
}

export interface AllocatedMemoryResources {
  MemoryMB: number;
  MemoryMaxMB: number;
}

export interface AllocatedDeviceResource {
  Vendor: string;
  Type: string;
  Name: string;
  DeviceIDs: string[];
}

export interface TaskLifecycle {
  Hook: string;
  Sidecar: boolean;
}

export interface AllocatedSharedResources {
  DiskMB: number;
  Networks?: NetworkResource[];
  Ports?: AllocatedPortMapping[];
}

export interface AllocatedPortMapping {
  Label: string;
  Value: number;
  To: number;
  HostIP: string;
}

export interface AllocationMetric {
  NodesEvaluated: number;
  NodesFiltered: number;
  NodesAvailable: Record<string, number>;
  ClassFiltered: Record<string, number>;
  ConstraintFiltered: Record<string, number>;
  NodesExhausted: number;
  ClassExhausted: Record<string, number>;
  DimensionExhausted: Record<string, number>;
  QuotaExhausted: string[];
  Scores: Record<string, number>;
  AllocationTime: number;
  CoalescedFailures: number;
}

export interface DesiredTransition {
  Migrate?: boolean;
  Reschedule?: boolean;
  ForceReschedule?: boolean;
}

export interface TaskState {
  State: 'pending' | 'running' | 'dead';
  Failed: boolean;
  Restarts: number;
  LastRestart?: string;
  StartedAt?: string;
  FinishedAt?: string;
  Events?: TaskEvent[];
  TaskHandle?: TaskHandle;
}

export interface TaskEvent {
  Type: string;
  Time: number;
  Message?: string;
  DisplayMessage?: string;
  Details?: Record<string, string>;
  FailsTask?: boolean;
  RestartReason?: string;
  SetupError?: string;
  DriverError?: string;
  DriverMessage?: string;
  ExitCode?: number;
  Signal?: number;
  KillReason?: string;
  KillTimeout?: number;
  KillError?: string;
  StartDelay?: number;
  DownloadError?: string;
  ValidationError?: string;
  DiskLimit?: number;
  FailedSibling?: string;
  VaultError?: string;
  TaskSignalReason?: string;
  TaskSignal?: string;
  GenericSource?: string;
}

export interface TaskHandle {
  Version: number;
  DriverState: any;
}

export interface DeploymentStatus {
  Healthy?: boolean;
  Timestamp?: string;
  Canary?: boolean;
  ModifyIndex?: number;
}

export interface RescheduleTracker {
  Events?: RescheduleEvent[];
}

export interface RescheduleEvent {
  RescheduleTime: number;
  PrevAllocID: string;
  PrevNodeID: string;
  Delay: number;
}

// Node types
export interface Node {
  ID: string;
  SecretID?: string;
  Datacenter: string;
  Name: string;
  HTTPAddr: string;
  TLSEnabled: boolean;
  Attributes: Record<string, string>;
  Resources?: Resources;
  Reserved?: Resources;
  NodeResources?: NodeResources;
  ReservedResources?: NodeReservedResources;
  Links?: Record<string, string>;
  Meta?: Record<string, string>;
  NodeClass?: string;
  ComputedClass?: string;
  Drain: boolean;
  DrainStrategy?: DrainStrategy;
  SchedulingEligibility: string;
  Status: 'initializing' | 'ready' | 'down' | 'disconnected';
  StatusDescription?: string;
  StatusUpdatedAt?: number;
  Events?: NodeEvent[];
  Drivers?: Record<string, DriverInfo>;
  HostVolumes?: Record<string, HostVolumeInfo>;
  HostNetworks?: Record<string, HostNetworkInfo>;
  CSIControllerPlugins?: Record<string, CSIInfo>;
  CSINodePlugins?: Record<string, CSIInfo>;
  CreateIndex: number;
  ModifyIndex: number;
}

export interface NodeListStub {
  ID: string;
  Datacenter: string;
  Name: string;
  NodeClass: string;
  NodePool?: string;
  Version: string;
  Drain: boolean;
  SchedulingEligibility: string;
  Status: string;
  StatusDescription?: string;
  Drivers?: Record<string, DriverInfo>;
  NodeResources?: NodeResources;
  ReservedResources?: NodeReservedResources;
  CreateIndex: number;
  ModifyIndex: number;
  Address: string;
}

export interface NodeResources {
  Cpu?: NodeCpuResources;
  Memory?: NodeMemoryResources;
  Disk?: NodeDiskResources;
  Networks?: NetworkResource[];
  Devices?: NodeDeviceResource[];
}

export interface NodeCpuResources {
  CpuShares: number;
}

export interface NodeMemoryResources {
  MemoryMB: number;
}

export interface NodeDiskResources {
  DiskMB: number;
}

export interface NodeDeviceResource {
  Vendor: string;
  Type: string;
  Name: string;
  Instances: NodeDevice[];
  Attributes: Record<string, Attribute>;
}

export interface NodeDevice {
  ID: string;
  Healthy: boolean;
  HealthDescription: string;
  Locality?: NodeDeviceLocality;
}

export interface NodeDeviceLocality {
  PciBusID: string;
}

export interface Attribute {
  Float?: number;
  Int?: number;
  String?: string;
  Bool?: boolean;
  Unit?: string;
}

export interface NodeReservedResources {
  Cpu?: NodeReservedCpuResources;
  Memory?: NodeReservedMemoryResources;
  Disk?: NodeReservedDiskResources;
  Networks?: NodeReservedNetworkResources;
}

export interface NodeReservedCpuResources {
  CpuShares: number;
}

export interface NodeReservedMemoryResources {
  MemoryMB: number;
}

export interface NodeReservedDiskResources {
  DiskMB: number;
}

export interface NodeReservedNetworkResources {
  ReservedHostPorts: string;
}

export interface DrainStrategy {
  DrainSpec?: DrainSpec;
  ForceDeadline?: string;
  StartedAt?: string;
}

export interface DrainSpec {
  Deadline: number;
  IgnoreSystemJobs: boolean;
}

export interface NodeEvent {
  Message: string;
  Subsystem: string;
  Details?: Record<string, string>;
  Timestamp?: string;
  CreateIndex: number;
}

export interface DriverInfo {
  Attributes?: Record<string, string>;
  Detected: boolean;
  Healthy: boolean;
  HealthDescription: string;
  UpdateTime: string;
}

export interface HostVolumeInfo {
  Path: string;
  ReadOnly: boolean;
}

export interface HostNetworkInfo {
  Name: string;
  CIDR: string;
  Interface: string;
  ReservedPorts: string;
}

export interface CSIInfo {
  PluginID: string;
  AllocID: string;
  Healthy: boolean;
  HealthDescription: string;
  UpdateTime: string;
  RequiresControllerPlugin: boolean;
  RequiresTopologies: boolean;
  ControllerInfo?: CSIControllerInfo;
  NodeInfo?: CSINodeInfo;
}

export interface CSIControllerInfo {
  SupportsReadOnlyAttach: boolean;
  SupportsAttachDetach: boolean;
  SupportsListVolumes: boolean;
  SupportsListVolumesAttachedNodes: boolean;
  SupportsCreateDeleteVolume: boolean;
  SupportsGetCapacity: boolean;
  SupportsGetVolumeByName: boolean;
  SupportsClone: boolean;
  SupportsCreateDeleteSnapshot: boolean;
  SupportsListSnapshots: boolean;
  SupportsExpand: boolean;
}

export interface CSINodeInfo {
  ID: string;
  MaxVolumes: number;
  AccessibleTopology?: CSITopology;
  RequiresNodeStageVolume: boolean;
}

export interface CSITopology {
  Segments: Record<string, string>;
}

// Namespace types
export interface Namespace {
  Name: string;
  Description?: string;
  Quota?: string;
  Meta?: Record<string, string>;
  Capabilities?: NamespaceCapabilities;
  NodePoolConfiguration?: NamespaceNodePoolConfiguration;
  CreateIndex: number;
  ModifyIndex: number;
}

export interface NamespaceCapabilities {
  EnabledTaskDrivers?: string[];
  DisabledTaskDrivers?: string[];
}

export interface NamespaceNodePoolConfiguration {
  Default?: string;
  Allowed?: string[];
  Denied?: string[];
}

// Variable types
export interface Variable {
  Namespace: string;
  Path: string;
  Items: Record<string, string>;
  CreateIndex: number;
  ModifyIndex: number;
  CreateTime: number;
  ModifyTime: number;
}

export interface VariableMetadata {
  Namespace: string;
  Path: string;
  CreateIndex: number;
  ModifyIndex: number;
  CreateTime: number;
  ModifyTime: number;
}

// ACL types
export interface ACLToken {
  AccessorID: string;
  SecretID: string;
  Name: string;
  Type: 'client' | 'management';
  Policies?: string[];
  Roles?: ACLTokenRoleLink[];
  Global: boolean;
  CreateTime?: string;
  ExpirationTime?: string;
  ExpirationTTL?: string;
  CreateIndex: number;
  ModifyIndex: number;
}

export interface ACLTokenRoleLink {
  ID?: string;
  Name?: string;
}

export interface ACLPolicy {
  Name: string;
  Description?: string;
  Rules: string;
  RulesJSON?: ACLPolicyRulesJSON;
  CreateIndex: number;
  ModifyIndex: number;
}

export interface ACLPolicyRulesJSON {
  Namespaces?: ACLPolicyNamespaceRule[];
  NodePools?: ACLPolicyNodePoolRule[];
  HostVolumes?: ACLPolicyHostVolumeRule[];
  Variables?: ACLPolicyVariableRule[];
  Agent?: ACLPolicyRule;
  Node?: ACLPolicyRule;
  Operator?: ACLPolicyRule;
  Quota?: ACLPolicyRule;
  Plugin?: ACLPolicyRule;
}

export interface ACLPolicyNamespaceRule {
  Name: string;
  Policy: string;
  Capabilities?: string[];
  Variables?: ACLPolicyVariableRule;
}

export interface ACLPolicyNodePoolRule {
  Name: string;
  Policy: string;
  Capabilities?: string[];
}

export interface ACLPolicyHostVolumeRule {
  Name: string;
  Policy: string;
  Capabilities?: string[];
}

export interface ACLPolicyVariableRule {
  PathSpec: string;
  Capabilities: string[];
}

export interface ACLPolicyRule {
  Policy: string;
}

// Evaluation types
export interface Evaluation {
  ID: string;
  Namespace: string;
  Priority: number;
  Type: string;
  TriggeredBy: string;
  JobID: string;
  JobModifyIndex: number;
  NodeID?: string;
  NodeModifyIndex: number;
  DeploymentID?: string;
  Status: 'blocked' | 'pending' | 'complete' | 'failed' | 'canceled';
  StatusDescription?: string;
  Wait?: number;
  WaitUntil?: string;
  NextEval?: string;
  PreviousEval?: string;
  BlockedEval?: string;
  RelatedEvals?: string[];
  FailedTGAllocs?: Record<string, AllocationMetric>;
  ClassEligibility?: Record<string, boolean>;
  EscapedComputedClass?: boolean;
  QuotaLimitReached?: string;
  AnnotatePlan?: boolean;
  QueuedAllocations?: Record<string, number>;
  LeaderACL?: string;
  SnapshotIndex?: number;
  CreateIndex: number;
  ModifyIndex: number;
  CreateTime?: number;
  ModifyTime?: number;
}

// Deployment types
export interface Deployment {
  ID: string;
  Namespace: string;
  JobID: string;
  JobVersion: number;
  JobModifyIndex: number;
  JobSpecModifyIndex: number;
  JobCreateIndex: number;
  IsMultiregion?: boolean;
  TaskGroups?: Record<string, DeploymentState>;
  Status: 'running' | 'paused' | 'failed' | 'successful' | 'cancelled' | 'pending' | 'initializing' | 'blocked';
  StatusDescription?: string;
  CreateIndex: number;
  ModifyIndex: number;
}

export interface DeploymentState {
  Promoted?: boolean;
  PlacedCanaries?: string[];
  DesiredCanaries: number;
  DesiredTotal: number;
  PlacedAllocs: number;
  HealthyAllocs: number;
  UnhealthyAllocs: number;
  AutoRevert?: boolean;
  ProgressDeadline?: number;
  RequireProgressBy?: string;
}

// Service types (Consul/Nomad native)
export interface ServiceRegistration {
  ID: string;
  ServiceName: string;
  Namespace: string;
  NodeID: string;
  Datacenter: string;
  JobID: string;
  AllocID: string;
  Tags?: string[];
  Address: string;
  Port: number;
  CreateIndex: number;
  ModifyIndex: number;
}

// Event types
export interface Event {
  Topic: string;
  Type: string;
  Key: string;
  FilterKeys?: string[];
  Index: number;
  Payload: any;
}

// Allocation stats
export interface AllocResourceUsage {
  ResourceUsage?: ResourceUsage;
  Tasks?: Record<string, TaskResourceUsage>;
  Timestamp: number;
}

export interface ResourceUsage {
  MemoryStats?: MemoryStats;
  CpuStats?: CpuStats;
  DeviceStats?: DeviceGroupStats[];
}

export interface MemoryStats {
  RSS: number;
  Cache: number;
  Swap: number;
  Usage: number;
  MaxUsage: number;
  KernelUsage: number;
  KernelMaxUsage: number;
  Measured: string[];
}

export interface CpuStats {
  SystemMode: number;
  UserMode: number;
  TotalTicks: number;
  ThrottledPeriods: number;
  ThrottledTime: number;
  Percent: number;
  Measured: string[];
}

export interface DeviceGroupStats {
  Vendor: string;
  Type: string;
  Name: string;
  InstanceStats: Record<string, DeviceStats>;
}

export interface DeviceStats {
  Summary?: StatValue;
  Stats?: StatObject;
  Timestamp: string;
}

export interface StatValue {
  Desc?: string;
  Float?: number;
  Int?: number;
  String?: string;
  Bool?: boolean;
  Unit?: string;
}

export interface StatObject {
  Nested: Record<string, StatObject>;
  Attributes: Record<string, StatValue>;
}

export interface TaskResourceUsage {
  ResourceUsage?: ResourceUsage;
  Timestamp: number;
  Pids?: Record<string, ResourceUsage>;
}

// File system types
export interface AllocFileInfo {
  Name: string;
  IsDir: boolean;
  Size: number;
  FileMode: string;
  ModTime: string;
}

// Cluster types (for frontend)
export interface ClusterConfig {
  name: string;
  server?: string;
  region?: string;
  auth_type: string;
  meta_data?: Record<string, any>;
  error?: string;
}
