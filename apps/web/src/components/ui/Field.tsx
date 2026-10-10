import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from '../../lib/cx';

const control =
  'w-full rounded-md border bg-surface px-3 text-[14px] text-ink placeholder:text-faint transition-colors outline-none focus-visible:outline-none focus:border-mint/70 focus:ring-2 focus:ring-mint/20 disabled:opacity-60';

function controlState(invalid: boolean) {
  return invalid ? 'border-over/60' : 'border-line hover:border-line-strong';
}

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  className?: string;
  optional?: boolean;
}

export function FieldShell({ label, hint, error, children, className, optional }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-muted">
        {label}
        {optional && <span className="ml-1.5 font-normal text-faint">optional</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-[12px] text-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-[12px] text-over">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  optional?: boolean;
  leading?: ReactNode;
  ref?: Ref<HTMLInputElement>;
  wrapperClassName?: string;
}

export function TextField({ label, hint, error, optional, leading, className, wrapperClassName, ref, ...rest }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          {leading && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[14px] text-faint">{leading}</span>}
          <input
            ref={ref}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cx(control, controlState(invalid), 'h-10', leading ? "pl-9" : "", className)}
            {...rest}
          />
        </div>
      )}
    </FieldShell>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  optional?: boolean;
  ref?: Ref<HTMLSelectElement>;
  wrapperClassName?: string;
  children: ReactNode;
}

export function SelectField({ label, hint, error, optional, className, wrapperClassName, ref, children, ...rest }: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cx(control, controlState(invalid), 'h-10 cursor-pointer appearance-none pr-9', className)}
            {...rest}
          >
            {children}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        </div>
      )}
    </FieldShell>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  optional?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

export function TextAreaField({ label, hint, error, optional, className, ref, ...rest }: TextAreaFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cx(control, controlState(invalid), 'min-h-20 resize-y py-2.5', className)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

/** Compact unlabeled-looking controls for filter bars; still carry an accessible label. */
export const compactControl = cx(control, 'h-9 border-line hover:border-line-strong text-[13px]');
