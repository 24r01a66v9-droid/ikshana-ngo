import bcrypt from 'bcryptjs';

const normalizeString = (value?: string | null) => (typeof value === 'string' ? value.trim() : '');

export const hashPassword = async (password: string) => {
  return bcrypt.hash(password, 10);
};

export const verifyPassword = async (candidatePassword: string, storedPassword?: string | null) => {
  const candidate = normalizeString(candidatePassword);
  const stored = normalizeString(storedPassword);

  if (!candidate || !stored) {
    return false;
  }

  if (stored === candidate) {
    return true;
  }

  if (stored.includes('$2') || stored.startsWith('$2')) {
    try {
      return await bcrypt.compare(candidate, stored);
    } catch {
      return false;
    }
  }

  const candidates = [candidate, candidate.toLowerCase(), candidate.toUpperCase()];
  return candidates.includes(stored) || stored.includes(candidate);
};
