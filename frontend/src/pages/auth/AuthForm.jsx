import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Shield, AlertCircle } from 'lucide-react';
import api, { login as saveSession } from '../../lib/api';
import { AmbientBackground } from '../../components/ui/AmbientBackground';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Button } from '../../components/ui/Button';

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
      const payload = isLogin ? { username, password } : { username, password, email, fullName, role: 'admin' };
      const response = await api.post(endpoint, payload);

      if (isLogin) {
        const token = response.data.token || response.data.accessToken;
        if (token) {
          saveSession(token, response.data.role, username);
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
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <AmbientBackground />

      <GlassPanel strong className="w-full max-w-md p-8 relative z-10">
        <div className="flex justify-center mb-8">
          <div
            className="w-16 h-16 rounded-[22px] flex items-center justify-center shadow-lg"
            style={{ background: isLogin ? 'linear-gradient(145deg, #6ba6ff, var(--accent))' : 'linear-gradient(145deg, #b791ff, var(--hue-violet))' }}
          >
            {isLogin ? <Lock className="w-7 h-7 text-white" /> : <Shield className="w-7 h-7 text-white" />}
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-center mb-2 tracking-tight text-[var(--ink)]">
          {isLogin ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="text-sm text-[var(--ink-muted)] text-center mb-8">
          {isLogin ? 'Sign in to your VORLAN home network.' : 'Set up an administrator account to get started.'}
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-2xl flex items-center gap-3 text-sm" style={{ background: 'rgba(255,100,130,0.1)', border: '1px solid rgba(255,100,130,0.25)', color: '#ff9bad' }}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--ink-muted)] mb-2 ml-1">Username</label>
            <input
              type="text"
              className="w-full bg-black/25 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]/60 transition-all placeholder:text-[var(--ink-faint)]"
              placeholder="Enter your username"
              value={username} onChange={(e) => setUsername(e.target.value)} required
            />
          </div>
          {!isLogin && (
            <div>
              <label className="block text-xs font-medium text-[var(--ink-muted)] mb-2 ml-1">Full name (optional)</label>
              <input
                type="text"
                className="w-full bg-black/25 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]/60 transition-all placeholder:text-[var(--ink-faint)]"
                placeholder="Enter your full name"
                value={fullName} onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          )}
          {!isLogin && (
            <div>
              <label className="block text-xs font-medium text-[var(--ink-muted)] mb-2 ml-1">Email</label>
              <input
                type="email"
                className="w-full bg-black/25 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]/60 transition-all placeholder:text-[var(--ink-faint)]"
                placeholder="Enter your email"
                value={email} onChange={(e) => setEmail(e.target.value)} required
              />
              <p className="text-xs text-[var(--ink-faint)] mt-1.5 ml-1">You won't be able to change this later.</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[var(--ink-muted)] mb-2 ml-1">Password</label>
            <input
              type="password"
              className="w-full bg-black/25 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]/60 transition-all placeholder:text-[var(--ink-faint)]"
              placeholder="Enter your password"
              value={password} onChange={(e) => setPassword(e.target.value)} required
            />
          </div>
          <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full mt-2">
            {loading ? (isLogin ? 'Signing in…' : 'Creating account…') : (isLogin ? 'Sign In' : 'Create Account')}
          </Button>
        </form>

        <div className="mt-7 text-center text-sm text-[var(--ink-muted)]">
          {isLogin ? (
            <p>New here? <Link to="/signup" className="font-medium transition-colors" style={{ color: 'var(--accent)' }}>Create an account</Link></p>
          ) : (
            <p>Already have an account? <Link to="/login" className="font-medium transition-colors" style={{ color: 'var(--accent)' }}>Sign in</Link></p>
          )}
        </div>
      </GlassPanel>
    </div>
  );
};
