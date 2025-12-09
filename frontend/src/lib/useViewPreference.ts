import { useState, useCallback, useEffect } from 'react';

export type ViewMode = 'grid' | 'table';

const STORAGE_KEY = 'caravan_view_preference';

/**
 * Get the current view preference from localStorage
 */
export function getViewPreference(): ViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'grid' || stored === 'table') {
      return stored;
    }
  } catch (e) {
    console.warn('Failed to read view preference from localStorage:', e);
  }
  return 'grid'; // Default to grid view
}

/**
 * Set the view preference in localStorage
 */
export function setViewPreference(mode: ViewMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch (e) {
    console.warn('Failed to save view preference to localStorage:', e);
  }
}

/**
 * Custom hook for managing view preference (grid vs table)
 * Persists the preference to localStorage for consistent experience across the app
 */
export function useViewPreference(): [ViewMode, (mode: ViewMode) => void, () => void] {
  const [viewMode, setViewMode] = useState<ViewMode>(getViewPreference);

  // Sync with localStorage on mount
  useEffect(() => {
    const stored = getViewPreference();
    if (stored !== viewMode) {
      setViewMode(stored);
    }
  }, []);

  // Update both state and localStorage
  const updateViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setViewPreference(mode);
  }, []);

  // Toggle between grid and table
  const toggleViewMode = useCallback(() => {
    const newMode = viewMode === 'grid' ? 'table' : 'grid';
    updateViewMode(newMode);
  }, [viewMode, updateViewMode]);

  return [viewMode, updateViewMode, toggleViewMode];
}

export default useViewPreference;

