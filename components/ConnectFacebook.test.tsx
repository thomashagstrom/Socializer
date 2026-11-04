import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ConnectFacebook from './ConnectFacebook';

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

function mockPages(pages: { id: string; name: string }[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ data: pages }) })),
  );
}

describe('ConnectFacebook', () => {
  afterEach(cleanup);
  beforeEach(() => {
    docs = [];
    linkWithPopup.mockReset().mockResolvedValue({});
    setDoc.mockClear();
    deleteDoc.mockClear();
  });

  it('lists the Page as connected after the user approves access on Facebook', async () => {
    mockPages([{ id: '1', name: 'Bakery' }]);
    render(<ConnectFacebook user={user} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect Facebook' }));
    fireEvent.click(await screen.findByLabelText('Bakery'));
    fireEvent.click(screen.getByRole('button', { name: 'Connect selected Pages' }));

    expect(await screen.findByRole('button', { name: 'Disconnect Bakery' })).toBeInTheDocument();
  });

  it('lets the user pick which of several Pages to connect', async () => {
    mockPages([
      { id: '1', name: 'Bakery' },
      { id: '2', name: 'Cafe' },
    ]);
    render(<ConnectFacebook user={user} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect Facebook' }));
    fireEvent.click(await screen.findByLabelText('Cafe'));
    fireEvent.click(screen.getByRole('button', { name: 'Connect selected Pages' }));

    await screen.findByRole('button', { name: 'Disconnect Cafe' });
    expect(screen.queryByRole('button', { name: 'Disconnect Bakery' })).not.toBeInTheDocument();
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('removes a disconnected Page so it can no longer be chosen', async () => {
    docs = [{ id: 'user-1_facebook_1', data: () => ({ pageId: '1', name: 'Bakery' }) }];
    render(<ConnectFacebook user={user} />);
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Bakery' }));

    await waitFor(() => expect(screen.queryByText('Bakery')).not.toBeInTheDocument());
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });

  it('shows a clear message and connects nothing when access is cancelled or refused', async () => {
    linkWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    mockPages([{ id: '1', name: 'Bakery' }]);
    render(<ConnectFacebook user={user} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect Facebook' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('cancelled or refused');
    expect(setDoc).not.toHaveBeenCalled();
    expect(screen.queryByText('Bakery')).not.toBeInTheDocument();
  });
});
