import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FoundersTeamPage from './FoundersTeamPage';

const useAuthMock = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<any>) => <div {...props}>{children}</div>,
    article: ({ children, ...props }: React.PropsWithChildren<any>) => <article {...props}>{children}</article>,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Link: ({ children, ...props }: React.PropsWithChildren<any>) => <a {...props}>{children}</a>,
  };
});

describe('FoundersTeamPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthMock.mockReturnValue({
      user: { id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' },
    });
  });

  it('allows admin users to drag leadership cards to reorder them', async () => {
    window.localStorage.setItem('ikshana-leadership-reset-complete', 'true');
    window.localStorage.setItem(
      'ikshana-leadership-members',
      JSON.stringify([
        {
          id: 'member-1',
          name: 'Ava',
          role: 'Founder',
          tenure: '2020-present',
          bio: 'A visionary leader.',
          image: 'avatar-1',
          category: 'founders',
          displayOrder: 1,
        },
        {
          id: 'member-2',
          name: 'Noah',
          role: 'Co-founder',
          tenure: '2021-present',
          bio: 'A community builder.',
          image: 'avatar-2',
          category: 'founders',
          displayOrder: 2,
        },
      ]),
    );

    render(<FoundersTeamPage />);

    const card = (await screen.findByText('Ava')).closest('article');
    expect(card).toHaveAttribute('draggable', 'true');
  });

  it('keeps biography optional when the data has no bio text', async () => {
    window.localStorage.setItem(
      'ikshana-leadership-members',
      JSON.stringify([
        {
          id: 'member-1',
          name: 'Asha Rao',
          role: 'Founder',
          tenure: '2026',
          bio: '',
          image: 'avatar-1',
          category: 'founders',
          displayOrder: 1,
        },
      ]),
    );

    render(<FoundersTeamPage />);

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.queryByText(/Dedicated member of the Ikshana leadership team/i)).not.toBeInTheDocument();
  });
});
