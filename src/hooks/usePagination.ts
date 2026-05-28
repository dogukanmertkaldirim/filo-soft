import { useState, useCallback, useMemo } from 'react';

export interface PaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface PaginationResult {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  offset: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setPageSize: (size: number) => void;
  setTotalCount: (count: number) => void;
  reset: () => void;
}

export function usePagination(initialPageSize: number = 20): PaginationResult {
  const [state, setState] = useState<PaginationState>({
    page: 1,
    pageSize: initialPageSize,
    totalCount: 0,
  });

  const totalPages = useMemo(() =>
    Math.max(1, Math.ceil(state.totalCount / state.pageSize)),
    [state.totalCount, state.pageSize]
  );

  const offset = useMemo(() =>
    (state.page - 1) * state.pageSize,
    [state.page, state.pageSize]
  );

  const hasNextPage = state.page < totalPages;
  const hasPrevPage = state.page > 1;

  const setPage = useCallback((page: number) => {
    setState(prev => ({
      ...prev,
      page: Math.max(1, Math.min(page, Math.ceil(prev.totalCount / prev.pageSize) || 1)),
    }));
  }, []);

  const nextPage = useCallback(() => {
    setState(prev => {
      const maxPages = Math.ceil(prev.totalCount / prev.pageSize) || 1;
      return {
        ...prev,
        page: Math.min(prev.page + 1, maxPages),
      };
    });
  }, []);

  const prevPage = useCallback(() => {
    setState(prev => ({
      ...prev,
      page: Math.max(1, prev.page - 1),
    }));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setState(prev => ({
      ...prev,
      pageSize: size,
      page: 1,
    }));
  }, []);

  const setTotalCount = useCallback((count: number) => {
    setState(prev => {
      const newTotalPages = Math.max(1, Math.ceil(count / prev.pageSize));
      return {
        ...prev,
        totalCount: count,
        page: Math.min(prev.page, newTotalPages),
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      page: 1,
    }));
  }, []);

  return {
    page: state.page,
    pageSize: state.pageSize,
    totalCount: state.totalCount,
    totalPages,
    offset,
    hasNextPage,
    hasPrevPage,
    setPage,
    nextPage,
    prevPage,
    setPageSize,
    setTotalCount,
    reset,
  };
}
