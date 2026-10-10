import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  BudgetDto,
  BudgetMonthDto,
  CategoryDto,
  ComparisonDto,
  CreateBudgetInput,
  CreateCategoryInput,
  CreateTransactionInput,
  DashboardDto,
  Paginated,
  TransactionDto,
  TransactionType,
  TrendDto,
  UpdateBudgetInput,
  UpdateCategoryInput,
  UpdateTransactionInput,
} from '@trackforge/shared';
import { api } from './api';

/** Anything derived from transactions must refresh when the ledger changes. */
export function invalidateLedger(qc: QueryClient): Promise<void> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['transactions'] }),
    qc.invalidateQueries({ queryKey: ['dashboard'] }),
    qc.invalidateQueries({ queryKey: ['budgets'] }),
    qc.invalidateQueries({ queryKey: ['reports'] }),
  ]).then(() => undefined);
}

/* ---------- categories ---------- */

export function useCategories(options: { type?: TransactionType; includeArchived?: boolean } = {}) {
  return useQuery({
    queryKey: ['categories', options.type ?? 'all', options.includeArchived ?? false],
    queryFn: () =>
      api.get<{ items: CategoryDto[] }>('/categories', {
        type: options.type,
        includeArchived: options.includeArchived ? 'true' : undefined,
      }),
    select: (d) => d.items,
    staleTime: 60_000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCategoryInput) => api.post<{ category: CategoryDto }>('/categories', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) => api.patch<{ category: CategoryDto }>(`/categories/${id}`, input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['categories'] });
      await invalidateLedger(qc);
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

/* ---------- transactions ---------- */

export interface TransactionQuery {
  q?: string;
  type?: TransactionType;
  categoryId?: string;
  paymentMethod?: string;
  from?: string;
  to?: string;
  minAmount?: string;
  maxAmount?: string;
  sort?: 'date' | 'amount' | 'merchant' | 'createdAt';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export function useTransactions(query: TransactionQuery) {
  return useQuery({
    queryKey: ['transactions', query],
    queryFn: ({ signal }) => api.get<Paginated<TransactionDto>>('/transactions', { ...query }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransactionInput) => api.post<{ transaction: TransactionDto }>('/transactions', input),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTransactionInput }) =>
      api.patch<{ transaction: TransactionDto }>(`/transactions/${id}`, input),
    onSuccess: () => invalidateLedger(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => invalidateLedger(qc),
  });
}

/* ---------- budgets ---------- */

export function useBudgets(month: string) {
  return useQuery({
    queryKey: ['budgets', month],
    queryFn: () => api.get<BudgetMonthDto>('/budgets', { month }),
    placeholderData: keepPreviousData,
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBudgetInput) => api.post<{ budget: BudgetDto }>('/budgets', input),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['budgets'] }), qc.invalidateQueries({ queryKey: ['dashboard'] })]),
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBudgetInput }) => api.patch<{ budget: BudgetDto }>(`/budgets/${id}`, input),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['budgets'] }), qc.invalidateQueries({ queryKey: ['dashboard'] })]),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['budgets'] }), qc.invalidateQueries({ queryKey: ['dashboard'] })]),
  });
}

export function useCopyBudgets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { fromMonth: string; toMonth: string }) => api.post<{ copied: number; skipped: number }>('/budgets/copy', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  });
}

/* ---------- dashboard & reports ---------- */

export function useDashboard(from: string, to: string) {
  return useQuery({
    queryKey: ['dashboard', from, to],
    queryFn: ({ signal }) => api.get<DashboardDto>('/dashboard', { from, to }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useComparison(month: string) {
  return useQuery({
    queryKey: ['reports', 'comparison', month],
    queryFn: ({ signal }) => api.get<ComparisonDto>('/reports/comparison', { month }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useTrend(from: string, to: string) {
  return useQuery({
    queryKey: ['reports', 'trend', from, to],
    queryFn: ({ signal }) => api.get<TrendDto>('/reports/trend', { from, to }, signal),
    placeholderData: keepPreviousData,
  });
}
