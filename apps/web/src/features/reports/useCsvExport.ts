import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

export interface ExportParams {
  from: string;
  to: string;
  type?: 'income' | 'expense' | undefined;
  categoryId?: string | undefined;
}

/** Downloads the server-generated CSV (formula-safe, row-limited) for the given range. */
export function useCsvExport() {
  const { notify } = useToast();
  const [pending, setPending] = useState(false);

  const run = async (params: ExportParams) => {
    setPending(true);
    try {
      const { blob, filename, rows } = await api.download('/exports/transactions.csv', { ...params });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(rows === 0 ? 'Exported an empty file: no transactions in that range' : `Exported ${rows ?? ''} transactions`.replace('  ', ' '));
    } catch (err) {
      notify(errorMessage(err), { tone: 'error' });
    } finally {
      setPending(false);
    }
  };

  return { run, pending };
}
