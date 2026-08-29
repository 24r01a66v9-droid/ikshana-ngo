import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { appendLocalReview, getLocalReviews } from './reviewStorage';

describe('reviewStorage', () => {
  const manifestPath = path.join(process.cwd(), 'uploads', 'reviews-manifest.json');

  afterEach(async () => {
    try {
      await fs.rm(path.dirname(manifestPath), { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('stores submitted reviews locally so they are not lost when Supabase is unavailable', async () => {
    const review = {
      id: 1001,
      user_name: 'Ada',
      rating: 5,
      comment: 'Amazing support and a warm community.',
      created_at: '2026-08-15T10:00:00.000Z',
    };

    await appendLocalReview(review);
    const stored = await getLocalReviews();

    expect(stored).toContainEqual(expect.objectContaining({
      id: 1001,
      user_name: 'Ada',
      rating: 5,
      comment: 'Amazing support and a warm community.',
    }));
  });
});
