import React, { createContext, useContext, useState, useEffect } from 'react';

const AUTH_STORAGE_KEY = 'ikshana-auth-user';
const AUTH_TOKEN_STORAGE_KEY = 'ikshana-auth-token';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message?: string; resetUrl?: string } | null | void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readJsonBody = async <T,>(res: Response): Promise<T | null> => {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const persistUser = (nextUser: User | null, nextToken?: string | null) => {
    setUser(nextUser);
    if (typeof window !== 'undefined') {
      if (nextUser) {
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
        const resolvedToken = nextToken ?? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
        if (resolvedToken) {
          window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, resolvedToken);
        } else {
          window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        }
      } else {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      }
    }
  };

  const checkAuth = async () => {
    try {
      const storedUser = typeof window !== 'undefined'
        ? window.localStorage.getItem(AUTH_STORAGE_KEY)
        : null;

      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser) as User;
          if (parsed?.email) {
            persistUser(parsed);
            setLoading(false);
            return;
          }
        } catch {
          // Ignore malformed stored auth state and continue to server check
        }
      }

      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          ...(typeof window !== 'undefined' && window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
            ? { Authorization: `Bearer ${window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)}` }
            : {}),
        },
      });
      if (res.status === 204 || !res.ok) {
        persistUser(null);
      } else {
        const data = await readJsonBody<{ user?: User | null }>(res);
        persistUser(data?.user ?? null);
      }
    } catch (error) {
      persistUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await readJsonBody<{ user?: User; error?: string; token?: string }>(res);

    if (!res.ok) {
      throw new Error(data?.error || 'Login failed');
    }

    if (!data?.user) {
      throw new Error('Login failed');
    }

    persistUser(data.user, data.token);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await readJsonBody<{ error?: string }>(res);

    if (!res.ok) {
      throw new Error(data?.error || 'Registration failed');
    }
  };

  const forgotPassword = async (email: string) => {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await readJsonBody<{ error?: string; message?: string; resetUrl?: string }>(res);

    if (!res.ok) {
      throw new Error(data?.error || 'Unable to process password reset');
    }

    return data;
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) : null;
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await readJsonBody<{ error?: string }>(res);

    if (!res.ok) {
      throw new Error(data?.error || 'Unable to change password');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    persistUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, forgotPassword, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
