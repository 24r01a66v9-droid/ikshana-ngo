import { describe, expect, it } from 'vitest';
import { createDevelopmentAdminAccount, shouldUseDevelopmentFallback } from '../auth/fallback';

describe('development auth fallback', () => {
  it('creates a development admin account when fallback auth is enabled', async () => {
    const account = await createDevelopmentAdminAccount({
      NODE_ENV: 'development',
      DEFAULT_ADMIN_EMAIL: 'admin@example.com',
      DEFAULT_ADMIN_PASSWORD: 'secret123',
    });

    expect(account.emails).toContain('admin@example.com');
    expect(account.emails).toContain('24r01a66v9@cmrithyderabad.edu.in');
    expect(account.role).toBe('admin');
    expect(account.passwordHash).toBeTruthy();
  });

  it('disables the fallback in production', () => {
    expect(shouldUseDevelopmentFallback({ NODE_ENV: 'production' })).toBe(false);
  });
});
