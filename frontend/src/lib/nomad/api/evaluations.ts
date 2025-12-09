import { Evaluation, AllocationListStub } from '../types';
import { get } from './requests';

export interface ListEvaluationsParams {
  namespace?: string;
  prefix?: string;
  filter?: string;
}

/**
 * List all evaluations
 */
export function listEvaluations(params?: ListEvaluationsParams): Promise<Evaluation[]> {
  return get('/v1/evaluations', params);
}

/**
 * Get a specific evaluation
 */
export function getEvaluation(evalId: string): Promise<Evaluation> {
  return get(`/v1/evaluation/${encodeURIComponent(evalId)}`);
}

/**
 * Get allocations for an evaluation
 */
export function getEvaluationAllocations(evalId: string): Promise<AllocationListStub[]> {
  return get(`/v1/evaluation/${encodeURIComponent(evalId)}/allocations`);
}
