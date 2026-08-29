import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PastEvents from './PastEvents';

const useAuthMock = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<any>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe('PastEvents', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      user: { id: 1, name: 'Admin', email: '24r01a66v9@cmrithyderabad.edu.in', role: 'user' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the admin event management controls for the known admin email', () => {
    useAuthMock.mockReturnValue({
      user: { id: 1, name: 'Admin', email: '24r01a66v9@cmrithyderabad.edu.in', role: 'user' },
    });

    render(<PastEvents />);

    expect(screen.getByRole('button', { name: /add new event/i })).toBeInTheDocument();
  });

  it('shows edit and delete actions only for admins', () => {
    useAuthMock.mockReturnValue({
      user: { id: 1, name: 'Viewer', email: 'viewer@example.com', role: 'user' },
    });

    render(<PastEvents />);

    expect(screen.queryByRole('button', { name: /edit event/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete event/i })).not.toBeInTheDocument();
  });

  it('shows a photo upload form for admins inside the event details modal', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 1, name: 'Admin', email: '24r01a66v9@cmrithyderabad.edu.in', role: 'admin' },
    });

    render(<PastEvents />);

    fireEvent.click((await screen.findAllByRole('button', { name: /view full event details/i }))[0]);

    expect(await screen.findByText(/event gallery/i)).toBeInTheDocument();
    expect(screen.getByText(/click to upload event photo/i)).toBeInTheDocument();
  });

  it('allows admin roles with mixed casing to manage events', () => {
    useAuthMock.mockReturnValue({
      user: { id: 1, name: 'Admin', email: 'other@example.com', role: 'Admin' },
    });

    render(<PastEvents />);

    expect(screen.getByRole('button', { name: /add new event/i })).toBeInTheDocument();
  });

  it('shows only the requested awareness and Gundla Pochampalley events', async () => {
    render(<PastEvents />);

    expect(await screen.findByText(/donation drive for world cancer awareness day/i)).toBeInTheDocument();
    expect(screen.getByText(/visit to gundla pochampalley/i)).toBeInTheDocument();
    expect(screen.queryByText(/siddhi 3\.0/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mock assembly/i)).not.toBeInTheDocument();
  });

  it('loads events from the API when available', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/api/events')) {
        return Promise.resolve(new Response(JSON.stringify([{ id: 'db-1', title: 'New DB Event', date: 'January 1, 2026', occasion: 'Test', description: 'Loaded from the API', activities: [] }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (String(input).includes('/api/photos')) {
        return Promise.resolve(new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      return Promise.resolve(new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    }));

    render(<PastEvents />);

    expect(await screen.findByText(/new db event/i)).toBeInTheDocument();
  });

  it('shows a friendly fallback when event gallery data cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    render(<PastEvents />);
    const detailButtons = await screen.findAllByRole('button', { name: /view full event details/i });
    fireEvent.click(detailButtons[0]);

    expect(await screen.findByText(/unable to load event gallery right now/i)).toBeInTheDocument();
  });
});
