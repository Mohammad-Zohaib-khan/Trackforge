import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type z } from 'zod';
import { SUPPORTED_CURRENCIES, registerSchema } from '@trackforge/shared';
import { AuthLayout } from './AuthLayout';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import { ApiError, errorMessage } from '../../lib/api';
import { useSession } from './session';

type Input = z.input<typeof registerSchema>;
type Output = z.output<typeof registerSchema>;

function guessCurrency(): Input['currency'] {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    const byRegion: Record<string, Input['currency']> = { IN: 'INR', GB: 'GBP', JP: 'JPY', CA: 'CAD', AU: 'AUD', SG: 'SGD', AE: 'AED', CH: 'CHF', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR' };
    return (region && byRegion[region]) || 'USD';
  } catch {
    return 'USD';
  }
}

export function RegisterPage() {
  const { register: createAccount } = useSession();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState, setError } = useForm<Input, unknown, Output>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', currency: guessCurrency() },
  });

  const onSubmit = async (values: Output) => {
    setFormError(null);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await createAccount({ ...values, ...(timeZone ? { timeZone } : {}) });
      navigate('/app', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_IN_USE') setError('email', { message: err.message });
      else if (err instanceof ApiError && Object.keys(err.fields).length) {
        for (const [field, message] of Object.entries(err.fields)) {
          if (field === 'name' || field === 'email' || field === 'password' || field === 'currency') setError(field, { message });
        }
      } else setFormError(errorMessage(err));
    }
  };

  return (
    <AuthLayout
      title="Create your ledger"
      subtitle="Starter categories are added for you. Rename or archive them any time."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-mint underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-md border border-over/30 bg-[#1a0d0c] px-3 py-2.5 text-[13px] text-over">
            {formError}
          </p>
        )}
        <TextField label="Name" autoComplete="name" autoFocus maxLength={80} error={formState.errors.name?.message} {...register('name')} />
        <TextField label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters, including a letter and a number."
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <SelectField label="Currency" hint="Used for every amount. You can change it until you record your first transaction." error={formState.errors.currency?.message} {...register('currency')}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <Button type="submit" size="lg" className="mt-2 w-full" loading={formState.isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
