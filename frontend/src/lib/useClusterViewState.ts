/**
 * Hook to persist and restore view state per cluster.
 * Saves sidebar state, namespace filters, and other UI preferences per cluster.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { getCluster } from './cluster';
import {
  getClusterViewState,
  saveClusterViewState,
  ClusterViewState,
} from './clusterPreferences';
import { useTypedSelector } from '../redux/hooks';
import { setNamespaceFilter } from '../redux/filterSlice';

interface UseClusterViewStateOptions {
  /** Enable auto-save of view state (default: true) */
  autoSave?: boolean;
  /** Debounce delay for auto-save in ms (default: 1000) */
  saveDelay?: number;
}

/**
 * Hook that automatically saves and restores view state per cluster.
 * 
 * Features:
 * - Saves namespace filters when they change
 * - Restores namespace filters when switching clusters
 * - Debounces saves to avoid excessive localStorage writes
 */
export function useClusterViewState(options: UseClusterViewStateOptions = {}) {
  const { autoSave = true, saveDelay = 1000 } = options;
  
  const dispatch = useDispatch();
  const currentCluster = getCluster();
  const prevClusterRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get current filter state
  const namespaces = useTypedSelector(state => state.filter.namespaces);
  
  // Restore view state when cluster changes
  useEffect(() => {
    if (!currentCluster) return;
    
    // Only restore on cluster change, not initial mount
    if (prevClusterRef.current !== null && prevClusterRef.current !== currentCluster) {
      const savedState = getClusterViewState(currentCluster);
      
      // Restore namespace filter
      if (savedState.namespaces && Array.isArray(savedState.namespaces)) {
        dispatch(setNamespaceFilter(savedState.namespaces));
      } else {
        // Clear filters when switching to a cluster with no saved state
        dispatch(setNamespaceFilter([]));
      }
    }
    
    prevClusterRef.current = currentCluster;
  }, [currentCluster, dispatch]);
  
  // Save view state when it changes
  useEffect(() => {
    if (!autoSave || !currentCluster) return;
    
    // Debounce save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      const currentState: ClusterViewState = {
        namespaces: Array.from(namespaces),
      };
      saveClusterViewState(currentCluster, currentState);
    }, saveDelay);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [namespaces, currentCluster, autoSave, saveDelay]);
  
  // Manual save function
  const saveViewState = useCallback((additionalState?: Partial<ClusterViewState>) => {
    if (!currentCluster) return;
    
    const currentState: ClusterViewState = {
      namespaces: Array.from(namespaces),
      ...additionalState,
    };
    saveClusterViewState(currentCluster, currentState);
  }, [currentCluster, namespaces]);
  
  // Get current saved state
  const getSavedState = useCallback(() => {
    if (!currentCluster) return null;
    return getClusterViewState(currentCluster);
  }, [currentCluster]);
  
  return {
    saveViewState,
    getSavedState,
    currentCluster,
  };
}

export default useClusterViewState;

