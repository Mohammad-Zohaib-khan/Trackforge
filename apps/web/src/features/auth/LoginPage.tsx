import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@trackforge/shared';
import { AuthLayout } from './AuthLayout';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { errorMessage } from '../../lib/api';
import { useSession } from './session';

export function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const from = (location.state as { from?: unknown } | null)?.from;
  const target = typeof from === 'string' && from.startsWith('/app') ? from : '/app';

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);
    try {
      await login(values);
      navigate(target, { replace: true });
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Your ledger is where you left it."
      footer={
        <>
          New to TrackForge?{' '}
          <Link to="/register" className="text-mint underline-offset-4 hover:underline">
            Create an account
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
        <TextField label="Email" type="email" autoComplete="email" autoFocus error={formState.errors.email?.message} {...register('email')} />
        <TextField label="Password" type="password" autoComplete="current-password" error={formState.errors.password?.message} {...register('password')} />
        <Button type="submit" size="lg" className="mt-2 w-full" loading={formState.isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
