import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Sparkles, Mail, Lock, AlertTriangle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Spinner } from '@/components/ui';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error: signUpError, data } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        
        if (data?.session) {
          setMessage("Account created successfully!");
        } else {
          setMessage("Registration successful! Please check your email to confirm your account.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-ink-50 dark:bg-ink-950 text-ink-900 dark:text-ink-50 p-4 transition-colors duration-200">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.05),transparent_50%)] pointer-events-none" />

      <div className="relative w-full max-w-md bg-white dark:bg-ink-900/60 dark:backdrop-blur-xl border border-ink-100 dark:border-ink-800/80 rounded-2xl shadow-2xl p-8 overflow-hidden animate-fadeIn">
        
        {/* Glow effect */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-accent-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
            <img src="/pmo-light.png" alt="PMO.AI Logo" className="w-12 h-12 object-contain block dark:hidden" />
            <img src="/pmo-dark.png" alt="PMO.AI Logo" className="w-12 h-12 object-contain hidden dark:block" />
          </div>
          <h2 className="text-xl font-bold text-ink-900 dark:text-white leading-tight">
            {isSignUp ? 'Create your account' : 'Sign in to PMO.AI'}
          </h2>
          <p className="text-xs text-ink-500 dark:text-ink-400 mt-1.5 text-center">
            {isSignUp ? 'Get started with autonomous project management' : 'Welcome back! Enter your details to continue.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error-500/10 border border-error-500/20 rounded-xl flex gap-3 text-error-700 dark:text-error-400 text-xs animate-slideDown">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Authentication failed</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-success-500/10 border border-success-500/20 rounded-xl flex gap-3 text-success-700 dark:text-success-400 text-xs animate-slideDown">
            <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold">Success</p>
              <p className="mt-0.5">{message}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-ink-50 dark:bg-ink-950/50 border border-ink-100 dark:border-ink-800 focus:border-brand-500 dark:focus:border-brand-500 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-ink-50 dark:bg-ink-950/50 border border-ink-100 dark:border-ink-800 focus:border-brand-500 dark:focus:border-brand-500 rounded-xl py-2.5 pl-10 pr-11 text-sm outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-600 dark:hover:text-white transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary !py-2.5 flex items-center justify-center gap-2 mt-2 font-medium"
          >
            {loading ? (
              <Spinner className="w-5 h-5 text-white" />
            ) : (
              <>
                {isSignUp ? 'Create Account' : 'Sign In'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-ink-100 dark:border-ink-800/80 text-center">
          <p className="text-xs text-ink-500 dark:text-ink-400">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setMessage(null);
              }}
              className="text-brand-500 hover:text-brand-600 font-semibold transition-colors"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
