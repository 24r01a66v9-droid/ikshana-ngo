import bcrypt from 'bcryptjs';

export interface DevelopmentAuthConfig {
  NODE_ENV?: string;
  DEFAULT_ADMIN_EMAIL?: string;
  DEFAULT_ADMIN_PASSWORD?: string;
}

export const shouldUseDevelopmentFallback = (env: DevelopmentAuthConfig = {}) => {
  return env.NODE_ENV !== 'production';
};

export const createDevelopmentAdminAccount = async (env: DevelopmentAuthConfig = {}) => {
  const password = env.DEFAULT_ADMIN_PASSWORD || 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);
  const configuredEmail = env.DEFAULT_ADMIN_EMAIL || '24r01a66v9@cmrithyderabad.edu.in';
  const emails = Array.from(new Set([
    configuredEmail,
    '24r01a66v9@cmrithyderabad.edu.in',
    'admin@ikshana.local',
  ].filter(Boolean)));

  return {
    emails,
    password,
    passwordHash,
    role: 'admin' as const,
    name: 'Development Admin',
  };
};
