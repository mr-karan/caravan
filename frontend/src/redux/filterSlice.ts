import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import { JSONPath } from 'jsonpath-plus';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';

export interface FilterState {
  /** The namespaces to filter on. */
  namespaces: Set<string>;
}

export const initialState: FilterState = {
  namespaces: new Set(),
};

/**
 * Filters a generic item based on the filter state.
 *
 * The item is considered to match if any of the matchCriteria (described as JSONPath)
 * matches the filter.search contents. Case matching is insensitive.
 *
 * @param item - The item to filter.
 * @param search - The search string.
 * @param matchCriteria - The JSONPath criteria to match.
 */
export function filterGeneric<T extends { [key: string]: any } = { [key: string]: any }>(
  item: T,
  search?: string,
  matchCriteria?: string[]
) {
  if (!search) {
    return true;
  }

  const filterString = search.toLowerCase();
  const usedMatchCriteria: string[] = [];

  // Use the custom matchCriteria if any
  (matchCriteria || []).forEach(jsonPath => {
    let values: any[];
    try {
      values = JSONPath({ path: '$' + jsonPath, json: item });
    } catch (err) {
      console.debug(
        `Failed to get value from JSONPath when filtering ${jsonPath} on item ${item}; skipping criteria`
      );
      return;
    }

    // Include matches values in the criteria
    values.forEach((value: any) => {
      if (typeof value === 'string' || typeof value === 'number') {
        // Don't use empty string, otherwise it'll match everything
        if (value !== '') {
          usedMatchCriteria.push(value.toString().toLowerCase());
        }
      } else if (Array.isArray(value)) {
        value.forEach((elem: any) => {
          if (!!elem && typeof elem === 'string') {
            usedMatchCriteria.push(elem.toLowerCase());
          }
        });
      }
    });
  });

  return !!usedMatchCriteria.find((item: string) => item.includes(filterString));
}

const filterSlice = createSlice({
  name: 'filter',
  initialState,
  reducers: {
    /**
     * Sets the namespace filter with an array of strings.
     */
    setNamespaceFilter(state, action: PayloadAction<string[]>) {
      state.namespaces = new Set(action.payload);
    },
    /**
     * Resets the filter state.
     */
    resetFilter(state) {
      state.namespaces = new Set();
    },
  },
});

export const { setNamespaceFilter, resetFilter } = filterSlice.actions;

export default filterSlice.reducer;

/**
 * Get globally selected namespaces
 *
 * @returns An array of selected namespaces, empty means all namespaces are visible
 */
export const useNamespaces = () => {
  const namespacesSet = useSelector(({ filter }: { filter: FilterState }) => filter.namespaces);
  return useMemo(() => [...namespacesSet], [namespacesSet]);
};
