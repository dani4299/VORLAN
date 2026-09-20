import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { login as saveSession } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';

export const AuthForm = ({ isLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      // Role is never sent from here — the server decides it (the first account on a fresh
      // install becomes admin automatically; every signup after that is a regular account, and
      // only an existing admin can promote someone in Control Panel).
      const payload = isLogin ? { username, password } : { username, password, email, fullName };
      const response = await api.post(endpoint, payload);

      if (isLogin) {
        const token = response.data.token || response.data.accessToken;
        if (token) {
          saveSession(token, response.data.role, response.data.username || username, response.data.refreshToken);
          window.location.href = '/dashboard';
        } else {
          setError('Something went wrong signing you in. Please try again.');
        }
      } else {
        navigate('/login');
      }
    } catch (err) {
      setError(err.response?.data?.error || (isLogin ? 'Incorrect username or password.' : 'Could not create your account. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4 py-10 bg-[var(--canvas)]">
      <div className="w-full max-w-sm">
        <p className="text-sm font-semibold text-[var(--ink)] mb-6">VORLAN</p>

        <div className="surface-strong rounded-[var(--radius-xl)] p-6">
          <h1 className="text-xl font-semibold text-[var(--ink)] mb-5">{isLogin ? 'Sign in' : 'Create an account'}</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus autoComplete="username" />
            {!isLogin && <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />}
            {!isLogin && (
              <TextField
                label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                hint="You can't change this later."
              />
            )}
            <TextField
              label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              minLength={isLogin ? undefined : 8} hint={isLogin ? undefined : 'At least 8 characters.'}
            />
            {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
            <Button type="submit" size="lg" loading={loading} className="w-full">{isLogin ? 'Sign in' : 'Create account'}</Button>
          </form>

          {!isLogin && <p className="mt-4 text-xs text-[var(--ink-muted)]">The first account created on a new VORLAN becomes its administrator. Everyone after that starts as a guest.</p>}
        </div>

        <p className="mt-5 text-sm text-[var(--ink-muted)]">
          {isLogin ? 'No account yet? ' : 'Already have an account? '}
          <Link to={isLogin ? '/signup' : '/login'} className="font-medium text-[var(--accent)] hover:underline">{isLogin ? 'Create one' : 'Sign in'}</Link>
        </p>
      </div>
    </main>
  );
};
