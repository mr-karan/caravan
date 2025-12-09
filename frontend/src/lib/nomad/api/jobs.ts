import { Job, JobListStub, AllocationListStub } from '../types';
import { get, post, remove } from './requests';

export interface ListJobsParams {
  namespace?: string;
  prefix?: string;
  filter?: string;
}

export interface JobVersions {
  versions: Job[];
  diffs: any[];
}

/**
 * List all jobs
 */
export function listJobs(params?: ListJobsParams): Promise<JobListStub[]> {
  return get('/v1/jobs', params);
}

/**
 * Get a specific job
 */
export function getJob(jobId: string, namespace?: string): Promise<Job> {
  return get('/v1/job', { id: jobId, namespace });
}

/**
 * Create or update a job
 */
export function updateJob(job: Job): Promise<{ EvalID: string; EvalCreateIndex: number; JobModifyIndex: number }> {
  return post(`/v1/job/${encodeURIComponent(job.ID!)}`, job);
}

/**
 * Delete a job
 */
export function deleteJob(jobId: string, purge = false, namespace?: string): Promise<{ EvalID: string }> {
  return remove('/v1/job', { id: jobId, purge, namespace });
}

/**
 * Dispatch a parameterized job
 */
export function dispatchJob(
  jobId: string,
  payload?: string,
  meta?: Record<string, string>,
  namespace?: string
): Promise<{ DispatchedJobID: string; EvalID: string }> {
  const query = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';
  return post(`/v1/job/${encodeURIComponent(jobId)}/dispatch${query}`, { payload, meta });
}

/**
 * Get allocations for a job
 */
export function getJobAllocations(jobId: string, namespace?: string): Promise<AllocationListStub[]> {
  return get('/v1/job/allocations', { id: jobId, namespace });
}

/**
 * Get job versions
 */
export function getJobVersions(jobId: string, namespace?: string): Promise<JobVersions> {
  return get('/v1/job/versions', { id: jobId, namespace });
}

/**
 * Scale a job task group
 */
export function scaleJob(
  jobId: string,
  group: string,
  count: number,
  namespace?: string
): Promise<{ EvalID: string }> {
  const query = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';
  return post(`/v1/job/${encodeURIComponent(jobId)}/scale${query}`, {
    target: { group },
    count,
    error: false,
    meta: {},
  });
}
