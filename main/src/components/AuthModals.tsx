import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalsProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export default function AuthModals({ isOpen, onClose, initialMode = 'login' }: AuthModalsProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState('');
  const { login, register, forgotPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setResetUrl('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        onClose();
      } else if (mode === 'forgot-password') {
        const result = await forgotPassword(email);
        const message = result?.message || 'If an account exists for that email, a reset link has been sent.';
        setSuccess(message);
        setResetUrl(result?.resetUrl || '/reset-password');
      } else {
        await register(name, email, password);
        setMode('login');
        setError('Registration successful! Please login.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleModeSwitch = (newMode: 'login' | 'register' | 'forgot-password') => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setResetUrl('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-[2.5rem] p-10 pill-shadow overflow-hidden"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 text-stone-400 hover:text-stone-900 transition-colors"
            >
              <X size={24} />
            </button>

            <div className="text-center mb-8">
              <h2 className="text-3xl font-serif mb-2">
                {mode === 'login' ? 'Welcome Back' : mode === 'forgot-password' ? 'Reset Password' : 'Join Ikshana'}
              </h2>
              <p className="text-stone-500">
                {mode === 'login' ? 'Sign in to your account' : mode === 'forgot-password' ? 'Enter your email to receive a reset link' : 'Create a new account'}
              </p>
            </div>

            {error && (
              <div className={`p-4 rounded-2xl mb-6 text-sm ${error.includes('successful') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 rounded-2xl mb-6 text-sm bg-emerald-50 text-emerald-600 space-y-2">
                <div>{success}</div>
                {(resetUrl || mode === 'forgot-password') && (
                  <div className="pt-2 border-t border-emerald-200">
                    <a 
                      href={resetUrl || '/reset-password'}
                      onClick={onClose}
                      className="inline-block bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                    >
                      Click here to reset password →
                    </a>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input
                    type="text"
                    placeholder="Full Name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  type="email"
                  placeholder="Email Address"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
                />
              </div>

              {(mode === 'login' || mode === 'register') && (
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input
                    type="password"
                    placeholder="Password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-red text-white py-4 rounded-2xl font-bold hover:bg-brand-red/90 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (mode === 'login' ? 'Sign In' : mode === 'forgot-password' ? 'Send Reset Link' : 'Create Account')}
              </button>
            </form>

            <div className="mt-8 text-center text-sm text-stone-500">
              {mode === 'forgot-password' ? (
                <button onClick={() => handleModeSwitch('login')} className="text-brand-red font-bold hover:underline">
                  Back to Sign In
                </button>
              ) : mode === 'login' ? (
                <div className="space-y-2">
                  <p>
                    Don't have an account?{' '}
                    <button onClick={() => handleModeSwitch('register')} className="text-brand-red font-bold hover:underline">
                      Register Now
                    </button>
                  </p>
                  <p>
                    Forgot your password?{' '}
                    <button onClick={() => handleModeSwitch('forgot-password')} className="text-brand-red font-bold hover:underline">
                      Reset it
                    </button>
                  </p>
                </div>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button onClick={() => handleModeSwitch('login')} className="text-brand-red font-bold hover:underline">
                    Sign In
                  </button>
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
