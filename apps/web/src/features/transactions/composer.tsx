import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { TransactionDto, TransactionType } from '@trackforge/shared';
import { TransactionFormDialog } from './TransactionFormDialog';

interface ComposerState {
  /** Increments on every open so each opening gets a fresh form; closing keeps the instance. */
  session: number;
  open: boolean;
  editing: TransactionDto | null;
  defaultType: TransactionType;
}

interface ComposerContextValue {
  open: (options?: { edit?: TransactionDto; type?: TransactionType }) => void;
}

const ComposerContext = createContext<ComposerContextValue | null>(null);

/** One transaction dialog for the whole signed-in app, openable from any page. */
export function TransactionComposerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ComposerState>({ session: 0, open: false, editing: null, defaultType: 'expense' });

  const open = useCallback<ComposerContextValue['open']>((options = {}) => {
    setState((s) => ({
      session: s.session + 1,
      open: true,
      editing: options.edit ?? null,
      defaultType: options.type ?? options.edit?.type ?? 'expense',
    }));
  }, []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <ComposerContext.Provider value={value}>
      {children}
      <TransactionFormDialog
        key={state.session}
        open={state.open}
        editing={state.editing}
        defaultType={state.defaultType}
        onClose={close}
      />
    </ComposerContext.Provider>
  );
}

export function useTransactionComposer(): ComposerContextValue {
  const ctx = useContext(ComposerContext);
  if (!ctx) throw new Error('useTransactionComposer must be used inside TransactionComposerProvider');
  return ctx;
}
