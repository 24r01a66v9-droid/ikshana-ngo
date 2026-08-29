import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import App from '../App';

describe('App', () => {
  beforeEach(() => {
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes('/api/auth/me')) {
        return Promise.resolve({ ok: true, status: 204, json: async () => ({}) } as Response);
      }

      if (url.includes('/api/photos') || url.includes('/api/leadership-members')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] } as Response);
      }

      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
    }) as typeof fetch;
  });

  test('renders navbar with IKSHANA text', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/IKSHANA/i).length).toBeGreaterThan(0);
    });
  });
});
