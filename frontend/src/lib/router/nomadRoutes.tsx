import React from 'react';
import type { Route } from './Route';
import { DefaultSidebars } from '../../components/Sidebar';

// Lazy load Nomad components
const ClusterOverview = React.lazy(() => import('../../components/nomad/cluster/ClusterOverview'));
const JobList = React.lazy(() => import('../../components/nomad/job/JobList'));
const JobDetails = React.lazy(() => import('../../components/nomad/job/JobDetails'));
const AllocationList = React.lazy(() => import('../../components/nomad/allocation/AllocationList'));
const AllocationDetails = React.lazy(() => import('../../components/nomad/allocation/AllocationDetails'));
const NodeList = React.lazy(() => import('../../components/nomad/node/NodeList'));
const NodeDetails = React.lazy(() => import('../../components/nomad/node/NodeDetails'));
const EvaluationList = React.lazy(() => import('../../components/nomad/evaluation/EvaluationList'));
const EvaluationDetails = React.lazy(() => import('../../components/nomad/evaluation/EvaluationDetails'));
const ServiceList = React.lazy(() => import('../../components/nomad/service/ServiceList'));
const ServiceDetails = React.lazy(() => import('../../components/nomad/service/ServiceDetails'));
const NamespaceList = React.lazy(() => import('../../components/nomad/namespace/NamespaceList'));
const VariableList = React.lazy(() => import('../../components/nomad/variable/VariableList'));
const VariableDetails = React.lazy(() => import('../../components/nomad/variable/VariableDetails'));
const TokenDetails = React.lazy(() => import('../../components/nomad/acl/TokenDetails'));
const OIDCCallback = React.lazy(() => import('../../components/App/OIDCCallback'));

/**
 * Nomad-specific routes for the Caravan UI
 */
export const nomadRoutes: { [routeName: string]: Route } = {
  // Jobs
  nomadJobs: {
    path: '/jobs',
    exact: true,
    name: 'Jobs',
    sidebar: 'nomadJobs',
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <JobList />
      </React.Suspense>
    ),
  },
  nomadJob: {
    path: '/jobs/:namespace/:name',
    exact: true,
    name: 'Job',
    sidebar: 'nomadJobs',
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <JobDetails />
      </React.Suspense>
    ),
  },

  // Allocations
  nomadAllocations: {
    path: '/allocations',
    exact: true,
    name: 'Allocations',
    sidebar: 'nomadAllocations',
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <AllocationList />
      </React.Suspense>
    ),
  },
  nomadAllocation: {
    path: '/allocations/:id',
    exact: true,
    name: 'Allocation',
    sidebar: 'nomadAllocations',
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <AllocationDetails />
      </React.Suspense>
    ),
  },

  // Nodes
  nomadNodes: {
    path: '/nodes',
    exact: true,
    name: 'Nodes',
    sidebar: 'nomadNodes',
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <NodeList />
      </React.Suspense>
    ),
  },
  nomadNode: {
    path: '/nodes/:id',
    exact: true,
    name: 'Node',
    sidebar: 'nomadNodes',
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <NodeDetails />
      </React.Suspense>
    ),
  },

  // Namespaces
  nomadNamespaces: {
    path: '/namespaces',
    exact: true,
    name: 'Namespaces',
    sidebar: 'nomadNamespaces',
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <NamespaceList />
      </React.Suspense>
    ),
  },

  // Variables
  nomadVariables: {
    path: '/variables',
    exact: true,
    name: 'Variables',
    sidebar: 'nomadVariables',
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <VariableList />
      </React.Suspense>
    ),
  },
  nomadVariable: {
    path: '/variables/:namespace/:path',
    exact: true,
    name: 'Variable',
    sidebar: 'nomadVariables',
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <VariableDetails />
      </React.Suspense>
    ),
  },

  // Evaluations
  nomadEvaluations: {
    path: '/evaluations',
    exact: true,
    name: 'Evaluations',
    sidebar: 'nomadEvaluations',
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <EvaluationList />
      </React.Suspense>
    ),
  },
  nomadEvaluation: {
    path: '/evaluations/:id',
    exact: true,
    name: 'Evaluation',
    sidebar: 'nomadEvaluations',
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <EvaluationDetails />
      </React.Suspense>
    ),
  },

  // Services
  nomadServices: {
    path: '/services',
    exact: true,
    name: 'Services',
    sidebar: 'nomadServices',
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <ServiceList />
      </React.Suspense>
    ),
  },
  nomadService: {
    path: '/services/:name',
    exact: true,
    name: 'Service',
    sidebar: 'nomadServices',
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <ServiceDetails />
      </React.Suspense>
    ),
  },

  // ACL Token
  nomadToken: {
    path: '/token',
    exact: true,
    name: 'ACL Token',
    sidebar: 'nomadToken',
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <TokenDetails />
      </React.Suspense>
    ),
  },

  // Cluster Overview
  nomadCluster: {
    path: '/',
    exact: true,
    name: 'Cluster',
    sidebar: 'cluster',
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <ClusterOverview />
      </React.Suspense>
    ),
  },

  // Home (cluster chooser)
  chooser: {
    path: '/clusters',
    exact: true,
    name: 'Clusters',
    sidebar: {
      item: 'home',
      sidebar: DefaultSidebars.HOME,
    },
    useClusterURL: false,
    noAuthRequired: true,
    component: React.lazy(() => import('../../components/App/Home')),
  },

  // Redirect root to clusters
  rootRedirect: {
    path: '/',
    exact: true,
    name: 'Root',
    sidebar: null,
    useClusterURL: false,
    noAuthRequired: true,
    component: () => {
      React.useEffect(() => {
        window.location.replace('/clusters');
      }, []);
      return null;
    },
  },

  // Login page for cluster authentication
  login: {
    path: '/login/:cluster',
    exact: true,
    name: 'Login',
    sidebar: null,
    useClusterURL: false,
    noAuthRequired: true,
    component: React.lazy(() => import('../../components/App/Login')),
  },

  // OIDC Callback - handles redirect from OIDC provider
  oidcCallback: {
    path: '/oidc/callback',
    exact: true,
    name: 'OidcAuth',
    sidebar: null,
    useClusterURL: false,
    noAuthRequired: true,
    hideAppBar: true,
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <OIDCCallback />
      </React.Suspense>
    ),
  },

  // Alternative OIDC callback path (for Nomad UI compatibility)
  oidcCallbackNomad: {
    path: '/ui/settings/tokens',
    exact: true,
    name: 'OidcAuth',
    sidebar: null,
    useClusterURL: false,
    noAuthRequired: true,
    hideAppBar: true,
    component: () => (
      <React.Suspense fallback={<div>Loading...</div>}>
        <OIDCCallback />
      </React.Suspense>
    ),
  },

  // Settings routes (reuse from original)
  settings: {
    path: '/settings/general',
    exact: true,
    name: 'Settings',
    sidebar: {
      item: 'settingsGeneral',
      sidebar: DefaultSidebars.HOME,
    },
    useClusterURL: false,
    noAuthRequired: true,
    component: React.lazy(() => import('../../components/App/Settings')),
  },

};

export default nomadRoutes;
