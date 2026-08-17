import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import { loginUser, clearError } from '../store/slices/authSlice';
import type { LoginRequest } from '../types/auth';

function Logo() {
  return (
    <div className="flex items-center gap-2.5 justify-center mb-10">
      <span className="rounded-full bg-[#dc2626] h-9 w-9 flex items-center justify-center border-white border-2 shrink-0">
        <span className="material-symbols-outlined text-white leading-none text-lg">play_arrow</span>
      </span>
      <span className="font-semibold text-xl text-white tracking-tighter">OpenWav</span>
    </div>
  );
}

function Field({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[#888] uppercase tracking-widest">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading, error, isAuthenticated } = useSelector((s: RootState) => s.auth);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginRequest>();

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: '#030303' }}
    >
      <div className="w-full max-w-sm">
        <Logo />

        <h1 className="text-2xl font-black text-white text-center leading-tight mb-1">
          Sign in
        </h1>
        <p className="text-sm text-[#666] text-center mb-8">
          Welcome back to your music
        </p>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg text-sm text-red-400 border border-red-500/20"
            style={{ background: 'rgba(239,68,68,0.06)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit((d) => dispatch(loginUser(d)))} className="flex flex-col gap-5">
          <Field label="Email" error={errors.email?.message}>
            <input
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email' },
              })}
              type="email"
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-[#555] outline-none transition-all border"
              style={{
                background: '#111',
                borderColor: errors.email ? '#ef4444' : 'rgba(255,255,255,0.08)',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
              onBlur={e => e.currentTarget.style.borderColor = errors.email ? '#ef4444' : 'rgba(255,255,255,0.08)'}
            />
          </Field>

          <Field label="Password" error={errors.password?.message}>
            <input
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'At least 6 characters' },
              })}
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-[#555] outline-none transition-all border"
              style={{
                background: '#111',
                borderColor: errors.password ? '#ef4444' : 'rgba(255,255,255,0.08)',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
              onBlur={e => e.currentTarget.style.borderColor = errors.password ? '#ef4444' : 'rgba(255,255,255,0.08)'}
            />
          </Field>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
            style={{ background: '#dc2626' }}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Signing in...
              </>
            ) : 'Sign in'}
          </button>
        </form>

        <p className="text-sm text-[#555] text-center mt-8">
          Don't have an account?{' '}
          <Link to="/register" className="text-white hover:text-[#aaa] transition-colors font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}