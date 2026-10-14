import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Logo } from '../components/layout/TopBar';
import { Button, Spinner, inputClass } from '../components/ui';
import { clearError, login, register } from '../store/auth';
import { useAppDispatch, useAppSelector } from '../store';

export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  const dispatch = useAppDispatch();
  useEffect(() => () => void dispatch(clearError()), [dispatch]);
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-center text-2xl font-bold">{title}</h1>
        <p className="mb-8 mt-1 text-center text-sm text-muted">{subtitle}</p>
        {children}
        <p className="mt-8 text-center text-sm text-muted">{footer}</p>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wider text-muted">
      {label}
      {children}
      {error && <span className="normal-case tracking-normal text-red-400">{error}</span>}
    </label>
  );
}

function useAuthRedirect() {
  const user = useAppSelector((s) => s.auth.user);
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  return user ? <Navigate to={from} replace /> : null;
}

export function LoginPage() {
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((s) => s.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const redirect = useAuthRedirect();
  if (redirect) return redirect;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    dispatch(login({ email: email.trim(), password }));
  };

  return (
    <AuthLayout title="Sign in" subtitle="to continue to OpenWav" footer={<>New here? <Link to="/signup" className="font-medium text-white hover:underline">Create an account</Link></>}>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
        <Field label="Email">
          <input className={inputClass} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" className="py-3" disabled={status === 'loading' || !email || !password}>
          {status === 'loading' ? <Spinner className="h-4 w-4" /> : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}

export function SignupPage() {
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((s) => s.auth);
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [touched, setTouched] = useState(false);
  const redirect = useAuthRedirect();
  if (redirect) return redirect;

  const errors = {
    username: /^[a-zA-Z0-9_-]{3,30}$/.test(form.username) ? undefined : '3–30 letters, numbers, _ or -',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? undefined : 'Enter a valid email',
    password: PASSWORD_RULE.test(form.password) ? undefined : 'At least 8 characters with a letter and a number',
    confirm: form.confirm === form.password ? undefined : 'Passwords do not match',
  };
  const valid = Object.values(errors).every((e) => !e);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (valid) dispatch(register({ username: form.username.trim(), email: form.email.trim(), password: form.password }));
  };

  return (
    <AuthLayout title="Create account" subtitle="Start building your library" footer={<>Already have an account? <Link to="/login" className="font-medium text-white hover:underline">Sign in</Link></>}>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
        <Field label="Username" error={touched ? errors.username : undefined}>
          <input className={inputClass} autoComplete="username" value={form.username} onChange={set('username')} />
        </Field>
        <Field label="Email" error={touched ? errors.email : undefined}>
          <input className={inputClass} type="email" autoComplete="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" error={touched ? errors.password : undefined}>
          <input className={inputClass} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Confirm password" error={touched ? errors.confirm : undefined}>
          <input className={inputClass} type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        </Field>
        <Button type="submit" className="py-3" disabled={status === 'loading'}>
          {status === 'loading' ? <Spinner className="h-4 w-4" /> : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
