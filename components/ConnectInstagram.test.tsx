import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ConnectInstagram from './ConnectInstagram';

const linkWithPopup = vi.fn();
vi.mock('firebase/auth', () => ({
  FacebookAuthProvider: Object.assign(
    class {
      addScope() {}
    },
    { credentialFromResult: () => ({ accessToken: 'placeholder-token' }) },
  ),
  linkWithPopup: (...args: unknown[]) => linkWithPopup(...args),
  reauthenticateWithPopup: vi.fn(),
}));

let docs: { id: string; data: () => unknown }[] = [];
let listener: (snapshot: { docs: typeof docs }) => void = () => {};
const setDoc = vi.fn(async (ref: { id: string }, data: unknown) => {
  docs = [...docs, { id: ref.id, data: () => data }];
  listener({ docs });
});
const deleteDoc = vi.fn(async (ref: { id: string }) => {
  docs = docs.filter((d) => d.id !== ref.id);
  listener({ docs });
});
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  serverTimestamp: () => 'ts',
  doc: (_db: unknown, _col: string, id: string) => ({ id }),
  setDoc: (...args: [{ id: string }, unknown]) => setDoc(...args),
  deleteDoc: (...args: [{ id: string }]) => deleteDoc(...args),
  onSnapshot: (_q: unknown, next: typeof listener) => {
    listener = next;
    next({ docs });
    return () => {};
  },
}));

vi.mock('@/lib/firebase', () => ({
  getFirebase: () => ({ auth: {}, db: {} }),
}));

const user = { uid: 'user-1' } as User;

function mockPages(pages: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ data: pages }) })),
  );
}

describe('ConnectInstagram', () => {
  afterEach(cleanup);
  beforeEach(() => {
    docs = [];
    linkWithPopup.mockReset().mockResolvedValue({});
    setDoc.mockClear();
    deleteDoc.mockClear();
  });

  it('lists the Instagram account as connected after the user approves access', async () => {
    mockPages([{ id: '1', name: 'Bakery', instagram_business_account: { id: 'ig1', username: 'bakery_ig' } }]);
    render(<ConnectInstagram user={user} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect Instagram' }));
    fireEvent.click(await screen.findByLabelText('@bakery_ig'));
    fireEvent.click(screen.getByRole('button', { name: 'Connect selected accounts' }));

    expect(
      await screen.findByRole('button', { name: 'Disconnect @bakery_ig' }),
    ).toBeInTheDocument();
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('explains how to switch a personal account and connects nothing', async () => {
    mockPages([{ id: '1', name: 'Bakery' }]);
    render(<ConnectInstagram user={user} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect Instagram' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('switch to a professional account');
    expect(setDoc).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^Disconnect/ })).not.toBeInTheDocument();
  });

  it('removes a disconnected account so it can no longer be chosen', async () => {
    docs = [
      { id: 'user-1_instagram_ig1', data: () => ({ accountId: 'ig1', username: 'bakery_ig' }) },
    ];
    render(<ConnectInstagram user={user} />);
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect @bakery_ig' }));

    await waitFor(() => expect(screen.queryByText('@bakery_ig')).not.toBeInTheDocument());
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });

  it('shows a clear message and connects nothing when access is refused', async () => {
    linkWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    mockPages([]);
    render(<ConnectInstagram user={user} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect Instagram' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('cancelled or refused');
    expect(setDoc).not.toHaveBeenCalled();
  });
});
