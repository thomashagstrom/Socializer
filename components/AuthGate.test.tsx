import { act, render, screen } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AuthGate from './AuthGate';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

let authCallback: (user: User | null) => void = () => {};
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: User | null) => void) => {
    authCallback = callback;
    return () => {};
  },
  signOut: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({
  getFirebase: () => ({ auth: {} }),
}));

describe('AuthGate', () => {
  beforeEach(() => replace.mockClear());

  it('sends a signed-out visitor to the sign-in page', () => {
    render(<AuthGate>{() => <p>Secret content</p>}</AuthGate>);
    act(() => authCallback(null));

    expect(replace).toHaveBeenCalledWith('/sign-in');
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });

  it('shows the protected content to a signed-in person without redirecting', () => {
    render(<AuthGate>{() => <p>Secret content</p>}</AuthGate>);
    act(() => authCallback({ uid: 'user-1', email: 'me@example.com' } as User));

    expect(screen.getByText('Secret content')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
