import type { ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from './Button';
import { errorMessage } from '../../lib/api';

export function EmptyState({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line px-6 py-10 sm:items-center sm:text-center">
      <h3 className="text-[15px] font-medium text-ink">{title}</h3>
      <p className="max-w-md text-[14px] text-muted">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'This section could not load' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-over/25 bg-[#1a0d0c] px-5 py-5">
      <h3 className="text-[15px] font-medium text-ink">{title}</h3>
      <p className="text-[14px] text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={<RotateCw aria-hidden className="size-3.5" />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
