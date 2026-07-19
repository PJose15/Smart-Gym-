'use client';

import { useState, type CSSProperties } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { WizardProgress } from '../components/WizardProgress';
import { onboardRegisterSchema, type OnboardRegisterInput } from '@/lib/validation/onboard';

// ─── Styles ──────────────────────────────────────────────

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 12,
  padding: '28px 24px 32px',
};

const headingStyle: CSSProperties = {
  fontSize: '1.375rem',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: '0 0 4px',
  letterSpacing: '-0.02em',
};

const subStyle: CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--color-text-secondary)',
  margin: '0 0 24px',
};

const fieldGroupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  marginBottom: 24,
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: '0.875rem',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  color: 'var(--color-text-primary)',
  fontSize: '0.9375rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const inputErrorStyle: CSSProperties = {
  ...inputStyle,
  border: '1px solid var(--color-red)',
};

const fieldErrorStyle: CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--color-red)',
  marginTop: 2,
};

const passwordWrapStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const showHideStyle: CSSProperties = {
  position: 'absolute',
  right: 10,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
  fontSize: '0.8125rem',
  padding: '4px 6px',
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
};

const submitButtonStyle: CSSProperties = {
  width: '100%',
  padding: '12px',
  backgroundColor: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: '0.9375rem',
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: '-0.01em',
};

const disabledButtonStyle: CSSProperties = {
  ...submitButtonStyle,
  opacity: 0.6,
  cursor: 'not-allowed',
};

const errorBannerStyle: CSSProperties = {
  backgroundColor: 'var(--bg-error-subtle)',
  border: '1px solid var(--border-error)',
  borderRadius: 8,
  padding: '12px 14px',
  marginBottom: 16,
  fontSize: '0.875rem',
  color: 'var(--color-red)',
};

const optionalLabelStyle: CSSProperties = {
  ...labelStyle,
  fontWeight: 400,
  color: 'var(--color-text-secondary)',
};

const signInLinkStyle: CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'underline',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  fontSize: 'inherit',
  padding: 0,
};

const GYM_TYPES = [
  { value: 'independent', label: 'Independent gym' },
  { value: 'crossfit', label: 'CrossFit' },
  { value: 'martial-arts', label: 'Martial arts' },
  { value: 'yoga', label: 'Yoga studio' },
  { value: 'personal-training', label: 'Personal training' },
  { value: 'corporate', label: 'Corporate wellness' },
  { value: 'other', label: 'Other' },
];

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OnboardRegisterInput>({
    resolver: zodResolver(onboardRegisterSchema),
    defaultValues: {
      gym_type: 'independent',
    },
  });

  const onSubmit = async (data: OnboardRegisterInput) => {
    setFormError(null);
    setIsDuplicateEmail(false);

    try {
      const res = await fetch('/api/onboard/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const body = await res.json() as { email: string };
        router.push(`/verify-email?email=${encodeURIComponent(body.email)}`);
        return;
      }

      if (res.status === 409) {
        setIsDuplicateEmail(true);
        setError('email', { message: 'An account with this email already exists.' });
        return;
      }

      if (res.status === 400) {
        const body = await res.json() as { fieldErrors?: Record<string, string[]> };
        if (body.fieldErrors) {
          for (const [field, msgs] of Object.entries(body.fieldErrors)) {
            setError(field as keyof OnboardRegisterInput, {
              message: msgs[0] ?? 'Invalid',
            });
          }
        } else {
          setFormError('Please check your inputs and try again.');
        }
        return;
      }

      setFormError('Something went wrong. Please try again.');
    } catch {
      setFormError('Network error. Please check your connection and try again.');
    }
  };

  return (
    <>
      <WizardProgress currentStep={1} />
      <div style={cardStyle}>
        <h1 style={headingStyle}>Create your gym</h1>
        <p style={subStyle}>Free 30-day trial. No credit card until step 3.</p>

        {formError && (
          <div style={errorBannerStyle} role="alert">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={fieldGroupStyle}>
            {/* Owner name */}
            <label style={labelStyle}>
              Your name
              <input
                {...register('owner_name')}
                type="text"
                autoComplete="name"
                style={errors.owner_name ? inputErrorStyle : inputStyle}
                placeholder="Jane Smith"
              />
              {errors.owner_name && (
                <span style={fieldErrorStyle} role="alert">
                  {errors.owner_name.message}
                </span>
              )}
            </label>

            {/* Email */}
            <label style={labelStyle}>
              Email
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                style={errors.email ? inputErrorStyle : inputStyle}
                placeholder="you@yourgym.com"
              />
              {errors.email && (
                <span style={fieldErrorStyle} role="alert">
                  {errors.email.message}
                  {isDuplicateEmail && (
                    <>
                      {' '}
                      <a href="/staff/login" style={signInLinkStyle}>
                        Sign in instead
                      </a>
                    </>
                  )}
                </span>
              )}
            </label>

            {/* Password */}
            <label style={labelStyle}>
              Password
              <div style={passwordWrapStyle}>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  style={{
                    ...(errors.password ? inputErrorStyle : inputStyle),
                    paddingRight: 52,
                  }}
                  placeholder="Min 8 characters"
                />
                <button
                  type="button"
                  style={showHideStyle}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && (
                <span style={fieldErrorStyle} role="alert">
                  {errors.password.message}
                </span>
              )}
            </label>

            {/* Gym name */}
            <label style={labelStyle}>
              Gym name
              <input
                {...register('gym_name')}
                type="text"
                autoComplete="organization"
                style={errors.gym_name ? inputErrorStyle : inputStyle}
                placeholder="Iron Society"
              />
              {errors.gym_name && (
                <span style={fieldErrorStyle} role="alert">
                  {errors.gym_name.message}
                </span>
              )}
            </label>

            {/* City (optional) */}
            <label style={optionalLabelStyle}>
              City <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span>
              <input
                {...register('city')}
                type="text"
                autoComplete="address-level2"
                style={errors.city ? inputErrorStyle : inputStyle}
                placeholder="Miami"
              />
              {errors.city && (
                <span style={fieldErrorStyle} role="alert">
                  {errors.city.message}
                </span>
              )}
            </label>

            {/* Gym type */}
            <label style={labelStyle}>
              Gym type
              <select
                {...register('gym_type')}
                style={errors.gym_type ? { ...selectStyle, border: '1px solid var(--color-red)' } : selectStyle}
              >
                {GYM_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {errors.gym_type && (
                <span style={fieldErrorStyle} role="alert">
                  {errors.gym_type.message}
                </span>
              )}
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={isSubmitting ? disabledButtonStyle : submitButtonStyle}
          >
            {isSubmitting ? 'Creating your gym...' : 'Create account'}
          </button>
        </form>
      </div>
    </>
  );
}
