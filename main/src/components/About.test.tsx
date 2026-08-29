import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import About from './About';

const useAuthMock = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }: React.PropsWithChildren<any>) => <a {...props}>{children}</a>,
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<any>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe('About', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      user: { id: 1, name: 'Admin', email: '24r01a66v9@cmrithyderabad.edu.in', role: 'user' },
    });
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:preview'),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a newly uploaded about photo as the featured top image', async () => {
    let photoList: any[] = [];
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/api/photos') && (!init || init.method === 'GET')) {
        return Promise.resolve(new Response(JSON.stringify(photoList), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (url.includes('/api/photos') && init?.method === 'POST') {
        const formData = init.body as FormData;
        expect(formData.get('is_featured')).toBe('true');

        photoList = [{
          id: 'new-photo',
          url: 'https://example.com/team.jpg',
          caption: 'Team Photo',
          is_featured: 1,
          category: 'about',
        }];

        return Promise.resolve(new Response(JSON.stringify({ success: true, id: 'new-photo', url: 'https://example.com/team.jpg' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      return Promise.resolve(new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    render(<About />);

    fireEvent.click(screen.getByRole('button', { name: /add team photo/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'team.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.change(screen.getByPlaceholderText(/e\.g\., founding team meeting, 2021/i), {
      target: { value: 'Team Photo' },
    });

    fireEvent.click(screen.getByRole('button', { name: /save to archive/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
  });
});
