// Core request functions
export { nomadRequest, get, post, put, remove } from './requests';
export type { RequestParams, NomadError } from './requests';

// Jobs API
export {
  listJobs,
  getJob,
  updateJob,
  deleteJob,
  dispatchJob,
  getJobAllocations,
  getJobVersions,
  getJobEvaluations,
  scaleJob,
} from './jobs';
export type { ListJobsParams, JobVersions } from './jobs';

// Allocations API
export {
  listAllocations,
  getAllocation,
  restartAllocation,
  stopAllocation,
  getAllocationStats,
  listAllocFiles,
  readAllocFile,
  streamAllocationLogs,
  execInAllocation,
} from './allocations';
export type { ListAllocationsParams } from './allocations';

// Nodes API
export {
  listNodes,
  getNode,
  drainNode,
  setNodeEligibility,
  getNodeAllocations,
} from './nodes';
export type { ListNodesParams } from './nodes';

// Namespaces API
export { listNamespaces, getNamespace } from './namespaces';
export type { ListNamespacesParams } from './namespaces';

// Variables API
export { listVariables, getVariable, putVariable, deleteVariable } from './variables';
export type { ListVariablesParams } from './variables';

// Evaluations API
export { listEvaluations, getEvaluation, getEvaluationAllocations } from './evaluations';
export type { ListEvaluationsParams } from './evaluations';

// Deployments API
export {
  listDeployments,
  getDeployment,
  promoteDeployment,
  failDeployment,
  pauseDeployment,
  getDeploymentAllocations,
} from './deployments';
export type { ListDeploymentsParams } from './deployments';

// Services API
export { listServices, getService, getServiceAllNamespaces } from './services';
export type { ListServicesParams, ServiceListStub } from './services';

// ACL API
export {
  listACLTokens,
  getSelfToken,
  getACLToken,
  listACLPolicies,
  getACLPolicy,
} from './acl';
export type { ListACLTokensParams, ListACLPoliciesParams } from './acl';

// Auth API
export { login, logout, checkAuth } from './auth';
export type { LoginResponse, AuthCheckResponse } from './auth';

// Events API
export {
  createEventStream,
  EventMultiplexer,
  getEventMultiplexer,
} from './events';
export type { EventTopic, EventStreamOptions, EventStreamMessage } from './events';
