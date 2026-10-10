import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Link, type LinkProps } from 'react-router';
import { Loader2 } from 'lucide-react';
import { cx } from '../../lib/cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out-soft disabled:pointer-events-none disabled:opacity-50 active:translate-y-px';

const variants: Record<Variant, string> = {
  primary: 'bg-mint text-[#03140d] hover:bg-[#b4ffe0] shadow-[inset_0_-1px_0_rgb(0_0_0/0.18)]',
  secondary: 'bg-elevated text-ink border border-line hover:border-line-strong hover:bg-raised',
  ghost: 'text-muted hover:text-ink hover:bg-white/[0.04]',
  quiet: 'text-mint hover:text-[#c6ffe8] underline-offset-4 hover:underline',
  danger: 'bg-[#3a1614] text-over border border-[#ff9b94]/30 hover:bg-[#4a1b18] hover:border-[#ff9b94]/50',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-sm',
  md: 'h-10 px-4 text-sm rounded-md',
  lg: 'h-12 px-6 text-[15px] rounded-md',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = 'primary', size = 'md', loading = false, icon, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function ButtonLink({ variant = 'primary', size = 'md', icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cx(base, variants[variant], sizes[size], className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  tone?: 'default' | 'danger';
}

export function IconButton({ label, children, className, tone = 'default', type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-8 items-center justify-center rounded-sm text-faint transition-colors',
        tone === 'danger' ? 'hover:bg-[#3a1614] hover:text-over' : 'hover:bg-white/[0.06] hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
