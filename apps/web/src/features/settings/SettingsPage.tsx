import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  DATE_STYLES,
  LOCALES,
  SUPPORTED_CURRENCIES,
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type DateStyle,
  type Locale,
  type SafeUser,
  type UpdatePreferencesInput,
  type UpdateProfileInput,
} from '@trackforge/shared';
import { Page } from '../../components/layout/Page';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { SelectField, TextField } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { useToast } from '../../components/ui/Toast';
import { useEffectsPreference } from '../../components/background/effectsPreference';
import { ApiError, api, errorMessage } from '../../lib/api';
import { formatDate, formatMoney } from '../../lib/format';
import { SESSION_KEY, useSession } from '../auth/session';

const DATE_STYLE_LABELS: Record<DateStyle, string> = { medium: 'Readable', short: 'Compact', iso: 'ISO (YYYY-MM-DD)' };
const LOCALE_LABELS: Record<Locale, string> = {
  'en-US': 'English (United States)',
  'en-GB': 'English (United Kingdom)',
  'en-IN': 'English (India)',
  'de-DE': 'Deutsch',
  'fr-FR': 'Français',
  'es-ES': 'Español',
  'ja-JP': '日本語',
};

export function SettingsPage() {
  const { user } = useSession();
  if (!user) return null;
  return (
    <Page title="Settings" description="Your profile, how figures are shown, and account security.">
      <div className="flex flex-col divide-y divide-line">
        <Row title="Profile" description="Your name appears in the sidebar. Email is your sign-in and cannot be changed here.">
          <ProfileForm user={user} />
        </Row>
        <Row title="Currency and formats" description="One currency per account keeps every total exact. It can change only before you record transactions.">
          <PreferencesForm user={user} />
        </Row>
        <Row title="Display" description="The animated water background is decorative. Turn it off to save battery; it is always off when your device asks for reduced motion.">
          <DisplaySettings />
        </Row>
        <Row title="Password" description="Changing your password signs out every other device.">
          <PasswordForm />
        </Row>
        <Row title="Sessions" description="Sign out everywhere except this browser, for example after using a shared computer.">
          <SessionsControl />
        </Row>
        <Row title="Delete account" description="Permanently removes your account, transactions, categories and budgets. This cannot be undone.">
          <DeleteAccount />
        </Row>
      </div>
    </Page>
  );
}

function Row({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 py-9 first:pt-2 lg:grid-cols-[minmax(0,320px)_minmax(0,560px)] lg:gap-16" aria-labelledby={`settings-${title}`}>
      <div>
        <h2 id={`settings-${title}`} className="text-[16px] font-semibold tracking-[-0.01em]">
          {title}
        </h2>
        <p className="mt-1 text-[13px] text-muted">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function ProfileForm({ user }: { user: SafeUser }) {
  const { updateUser } = useSession();
  const { notify } = useToast();
  const { register, handleSubmit, formState, reset } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user.name },
  });
  const onSubmit = async (values: UpdateProfileInput) => {
    try {
      const res = await api.patch<{ user: SafeUser }>('/users/me', values);
      updateUser(res.user);
      reset({ name: res.user.name });
      notify('Profile saved');
    } catch (err) {
      notify(errorMessage(err), { tone: 'error' });
    }
  };
  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <TextField label="Name" maxLength={80} autoComplete="name" error={formState.errors.name?.message} {...register('name')} />
      <TextField label="Email" value={user.email} readOnly disabled />
      <div>
        <Button type="submit" variant="secondary" loading={formState.isSubmitting} disabled={!formState.isDirty}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

function PreferencesForm({ user }: { user: SafeUser }) {
  const { updateUser } = useSession();
  const { notify } = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState(user.preferences);
  const [saving, setSaving] = useState(false);
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const timeZones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return [user.preferences.timeZone];
    }
  }, [user.preferences.timeZone]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(user.preferences);

  const save = async () => {
    const patch: UpdatePreferencesInput = {};
    if (draft.currency !== user.preferences.currency) patch.currency = draft.currency;
    if (draft.locale !== user.preferences.locale) patch.locale = draft.locale;
    if (draft.timeZone !== user.preferences.timeZone) patch.timeZone = draft.timeZone;
    if (draft.dateStyle !== user.preferences.dateStyle) patch.dateStyle = draft.dateStyle;
    setSaving(true);
    setCurrencyError(null);
    try {
      const res = await api.patch<{ user: SafeUser }>('/users/me/preferences', patch);
      updateUser(res.user);
      await qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== SESSION_KEY[0] });
      notify('Preferences saved');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CURRENCY_LOCKED') {
        setCurrencyError(err.message);
        setDraft((d) => ({ ...d, currency: user.preferences.currency }));
      } else notify(errorMessage(err), { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Currency" value={draft.currency} error={currencyError ?? undefined} onChange={(e) => setDraft({ ...draft, currency: e.target.value as SafeUser['preferences']['currency'] })}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <SelectField label="Number and date language" value={draft.locale} onChange={(e) => setDraft({ ...draft, locale: e.target.value as Locale })}>
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_LABELS[l]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Time zone" hint="Decides which day counts as today for new entries and periods." value={draft.timeZone} onChange={(e) => setDraft({ ...draft, timeZone: e.target.value })}>
          {timeZones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, ' ')}
            </option>
          ))}
        </SelectField>
        <SelectField label="Date style" value={draft.dateStyle} onChange={(e) => setDraft({ ...draft, dateStyle: e.target.value as DateStyle })}>
          {DATE_STYLES.map((d) => (
            <option key={d} value={d}>
              {DATE_STYLE_LABELS[d]}
            </option>
          ))}
        </SelectField>
      </div>
      <p className="tabular rounded-md border border-line bg-surface/60 px-4 py-3 text-[13px] text-muted">
        Preview: {formatMoney(123456789, draft)} on {formatDate('2026-03-14', draft)}
      </p>
      <div>
        <Button variant="secondary" loading={saving} disabled={!dirty} onClick={() => void save()}>
          Save preferences
        </Button>
      </div>
    </div>
  );
}

function DisplaySettings() {
  const [effects, setEffects] = useEffectsPreference();
  return (
    <Segmented
      label="Animated background"
      value={effects}
      onChange={setEffects}
      options={[
        { value: 'on', label: 'Animated background' },
        { value: 'off', label: 'Static background' },
      ]}
    />
  );
}

function PasswordForm() {
  const { rotateCsrf } = useSession();
  const { notify } = useToast();
  const { register, handleSubmit, formState, reset, setError } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const onSubmit = async (values: ChangePasswordInput) => {
    try {
      const res = await api.post<{ csrfToken: string }>('/users/me/password', values);
      rotateCsrf(res.csrfToken);
      reset();
      notify('Password changed. Other devices were signed out.');
    } catch (err) {
      if (err instanceof ApiError && err.fields['currentPassword']) setError('currentPassword', { message: err.fields['currentPassword'] });
      else if (err instanceof ApiError && err.fields['newPassword']) setError('newPassword', { message: err.fields['newPassword'] });
      else notify(errorMessage(err), { tone: 'error' });
    }
  };
  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <TextField label="Current password" type="password" autoComplete="current-password" error={formState.errors.currentPassword?.message} {...register('currentPassword')} />
      <TextField label="New password" type="password" autoComplete="new-password" hint="At least 10 characters with a letter and a number." error={formState.errors.newPassword?.message} {...register('newPassword')} />
      <div>
        <Button type="submit" variant="secondary" loading={formState.isSubmitting}>
          Change password
        </Button>
      </div>
    </form>
  );
}

function SessionsControl() {
  const { notify } = useToast();
  const [pending, setPending] = useState(false);
  const run = async () => {
    setPending(true);
    try {
      const res = await api.post<{ revoked: number }>('/users/me/sessions/revoke-others');
      notify(res.revoked ? `Signed out ${res.revoked} other ${res.revoked === 1 ? 'session' : 'sessions'}` : 'No other sessions were active');
    } catch (err) {
      notify(errorMessage(err), { tone: 'error' });
    } finally {
      setPending(false);
    }
  };
  return (
    <Button variant="secondary" loading={pending} onClick={() => void run()}>
      Sign out other sessions
    </Button>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await api.delete('/users/me', { password });
      qc.clear();
      qc.setQueryData(SESSION_KEY, null);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.fields['password'] ? err.fields['password'] : errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Delete your account?"
        description="Every transaction, category and budget is deleted permanently."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep account
            </Button>
            <Button variant="danger" loading={pending} disabled={!password} onClick={() => void confirm()}>
              Delete permanently
            </Button>
          </>
        }
      >
        <TextField label="Confirm with your password" type="password" autoComplete="current-password" value={password} error={error ?? undefined} onChange={(e) => setPassword(e.target.value)} />
      </Dialog>
    </>
  );
}
