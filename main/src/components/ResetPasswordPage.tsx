import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, Lock } from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [questionsAnswered, setQuestionsAnswered] = useState(false);

  const [answer1, setAnswer1] = useState('');
  const [answer2, setAnswer2] = useState('');
  const [answer3, setAnswer3] = useState('');
  const [questionError, setQuestionError] = useState('');

  const adminEmails = useMemo(
    () => ['24r01a66v9@cmrithyderabad.edu.in', 'admin@ikshana.local'],
    []
  );

  const decodedEmail = useMemo(() => {
    if (!token) return '';

    try {
      const payload = token.split('.')[1];
      if (!payload) return '';

      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const decoded = atob(padded);
      const parsed = JSON.parse(decoded) as { email?: string };
      return (parsed.email || '').toLowerCase();
    } catch {
      return '';
    }
  }, [token]);

  const isAdminReset = useMemo(
    () => Boolean(decodedEmail && adminEmails.includes(decodedEmail)),
    [decodedEmail, adminEmails]
  );

  const correctAnswers = {
    q1: 'bus',
    q2: 'sharma family',
    q3: 'lighthouse'
  };

  useEffect(() => {
    if (!token) {
      setError('Missing reset token.');
      setQuestionsAnswered(true);
      return;
    }

    if (!isAdminReset) {
      setQuestionsAnswered(true);
    } else {
      setQuestionsAnswered(false);
    }
  }, [token, isAdminReset]);

  const handleQuestionsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuestionError('');

    const a1 = answer1.toLowerCase().trim();
    const a2 = answer2.toLowerCase().trim();
    const a3 = answer3.toLowerCase().trim();

    if (a1 !== correctAnswers.q1) {
      setQuestionError('Incorrect answer to question 1.');
      return;
    }

    if (a2 !== correctAnswers.q2) {
      setQuestionError('Incorrect answer to question 2.');
      return;
    }

    if (a3 !== correctAnswers.q3) {
      setQuestionError('Incorrect answer to question 3.');
      return;
    }

    setQuestionsAnswered(true);
    setQuestionError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to reset password');
      }

      setSuccess('Password reset successful. You can now sign in.');
      setTimeout(() => navigate('/'), 1500);
    } catch (err: any) {
      setError(err.message || 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-24 bg-stone-50">
      <div className="w-full max-w-md rounded-[2.5rem] bg-white p-8 pill-shadow">
        {!questionsAnswered && isAdminReset ? (
          <>
            <h2 className="text-3xl font-serif mb-2 text-center">Verify Your Identity</h2>
            <p className="text-stone-500 text-center mb-8">Answer these security questions before resetting the admin password.</p>

            {questionError && <div className="p-4 rounded-2xl mb-6 text-sm bg-red-50 text-red-600">{questionError}</div>}

            <form onSubmit={handleQuestionsSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-serif text-stone-700 mb-2">What is the place answer?</label>
                <input
                  type="text"
                  placeholder="Your answer"
                  required
                  value={answer1}
                  onChange={(e) => setAnswer1(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-maroon/20 focus:border-brand-maroon transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-serif text-stone-700 mb-2">What is your personal future Google answer?</label>
                <input
                  type="text"
                  placeholder="Your answer"
                  required
                  value={answer2}
                  onChange={(e) => setAnswer2(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-maroon/20 focus:border-brand-maroon transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-serif text-stone-700 mb-2">Secret nickname someone special calls you?</label>
                <input
                  type="text"
                  placeholder="Your answer"
                  required
                  value={answer3}
                  onChange={(e) => setAnswer3(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-maroon/20 focus:border-brand-maroon transition-all"
                />
              </div>

              <button type="submit" className="w-full bg-brand-maroon text-white py-4 rounded-2xl font-bold hover:bg-brand-maroon/90 transition-all">
                Verify Answers
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-serif mb-2 text-center">Set New Password</h2>
            <p className="text-stone-500 text-center mb-8">Choose a new password for your account.</p>

            {error && <div className="p-4 rounded-2xl mb-6 text-sm bg-red-50 text-red-600">{error}</div>}
            {success && (
              <div className="p-4 rounded-2xl mb-6 text-sm bg-emerald-50 text-emerald-600 flex items-center gap-2">
                <CheckCircle2 size={16} />
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  type="password"
                  placeholder="New Password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  type="password"
                  placeholder="Confirm New Password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
                />
              </div>

              <button type="submit" disabled={loading} className="w-full bg-brand-red text-white py-4 rounded-2xl font-bold hover:bg-brand-red/90 transition-all flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
