import { render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

function LoginErrorProbe() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    login('test@example.com', 'password').catch((err: Error) => setError(err.message));
  }, [login]);

  return <div>{error ?? 'no-error'}</div>;
}

function LoginProbe() {
  const { login } = useAuth();
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    login('test@example.com', 'password')
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'));
  }, [login]);

  return <div>{status}</div>;
}

function ForgotPasswordProbe() {
  const { forgotPassword } = useAuth();
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    forgotPassword('test@example.com')
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'));
  }, [forgotPassword]);

  return <div>{status}</div>;
}

function ChangePasswordProbe() {
  const { changePassword } = useAuth();
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    changePassword('current-pass', 'new-pass123')
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'));
  }, [changePassword]);

  return <div>{status}</div>;
}

describe('AuthProvider', () => {
  it('shows a friendly error when the login endpoint returns no JSON body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '',
    } as Response);

    render(
      <AuthProvider>
        <LoginErrorProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });
  });

  it('stores a token returned by login for later requests', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        user: { id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' },
        token: 'test-token',
      }),
    } as Response);

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(window.localStorage.getItem('ikshana-auth-token')).toBe('test-token');
    });
  });

  it('preserves an existing auth token when restoring a persisted user', async () => {
    window.localStorage.setItem('ikshana-auth-user', JSON.stringify({ id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' }));
    window.localStorage.setItem('ikshana-auth-token', 'persisted-token');

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ user: { id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' } }),
    } as Response);

    render(<AuthProvider><div>ready</div></AuthProvider>);

    await waitFor(() => {
      expect(window.localStorage.getItem('ikshana-auth-token')).toBe('persisted-token');
    });
  });

  it('calls the forgot-password endpoint', async () => {
    global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ user: { id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' } }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      } as Response;
    });

    render(
      <AuthProvider>
        <ForgotPasswordProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('ok')).toBeInTheDocument();
    });
  });

  it('calls the change-password endpoint', async () => {
    global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ user: { id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' } }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      } as Response;
    });

    render(
      <AuthProvider>
        <ChangePasswordProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('ok')).toBeInTheDocument();
    });
  });
});
