import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import { registerUser, clearError } from '../store/slices/authSlice';
import type { RegisterRequest } from '../types/auth';

interface RegisterFormData extends RegisterRequest {
  confirmPassword: string;
}

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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[#888] uppercase tracking-widest">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function StyledInput({ hasError, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }) {
  return (
    <input
      {...props}
      className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-[#555] outline-none transition-all border"
      style={{ background: '#111', borderColor: hasError ? '#ef4444' : 'rgba(255,255,255,0.08)' }}
      onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
      onBlur={e => e.currentTarget.style.borderColor = hasError ? '#ef4444' : 'rgba(255,255,255,0.08)'}
    />
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading, error, isAuthenticated } = useSelector((s: RootState) => s.auth);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterFormData>();
  const watchPassword = watch('password');

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  const onSubmit = (data: RegisterFormData) => {
    const { confirmPassword, ...registerData } = data;
    dispatch(registerUser(registerData));
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#030303' }}>
      <div className="w-full max-w-sm">
        <Logo />

        <h1 className="text-2xl font-black text-white text-center leading-tight mb-1">
          Create account
        </h1>
        <p className="text-sm text-[#666] text-center mb-8">
          Start building your music library
        </p>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg text-sm text-red-400 border border-red-500/20"
            style={{ background: 'rgba(239,68,68,0.06)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <Field label="Username" error={errors.username?.message}>
            <StyledInput
              {...register('username', {
                required: 'Username is required',
                minLength: { value: 3, message: 'At least 3 characters' },
                maxLength: { value: 30, message: 'Max 30 characters' },
                pattern: { value: /^[a-zA-Z0-9_]+$/, message: 'Letters, numbers and underscores only' },
              })}
              type="text"
              placeholder="username"
              hasError={!!errors.username}
            />
          </Field>

          <Field label="Email" error={errors.email?.message}>
            <StyledInput
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email' },
              })}
              type="email"
              placeholder="you@example.com"
              hasError={!!errors.email}
            />
          </Field>

          <Field label="Password" error={errors.password?.message}>
            <StyledInput
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'At least 8 characters' },
              })}
              type="password"
              placeholder="••••••••"
              hasError={!!errors.password}
            />
          </Field>

          <Field label="Confirm Password" error={errors.confirmPassword?.message}>
            <StyledInput
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: v => v === watchPassword || 'Passwords do not match',
              })}
              type="password"
              placeholder="••••••••"
              hasError={!!errors.confirmPassword}
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
                Creating account...
              </>
            ) : 'Create account'}
          </button>
        </form>

        <p className="text-sm text-[#555] text-center mt-8">
          Already have an account?{' '}
          <Link to="/login" className="text-white hover:text-[#aaa] transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}