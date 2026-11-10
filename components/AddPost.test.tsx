import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AddPost from './AddPost';

const addDoc = vi.fn(async () => ({}));
const uploadBytes = vi.fn(async () => ({}));
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  serverTimestamp: () => 'ts',
  addDoc: (...args: unknown[]) => addDoc(...(args as [])),
  onSnapshot: (_q: unknown, next: (s: { docs: unknown[] }) => void) => {
    next({
      docs: [
        { id: 'a1', data: () => ({ provider: 'instagram', username: 'bakery_ig' }) },
        { id: 'a2', data: () => ({ provider: 'facebook', name: 'Bakery' }) },
      ],
    });
    return () => {};
  },
}));
vi.mock('firebase/storage', () => ({
  ref: (_s: unknown, path: string) => ({ path }),
  uploadBytes: (...args: unknown[]) => uploadBytes(...(args as [])),
  getDownloadURL: async () => 'https://example.test/media',
}));
vi.mock('@/lib/firebase', () => ({
  getFirebase: () => ({ auth: {}, db: {}, storage: {} }),
}));

const user = { uid: 'user-1' } as User;
const future = '2999-01-01T10:00';

function pickFile(file: File) {
  fireEvent.change(screen.getByLabelText(/Photo or video/), { target: { files: [file] } });
}
const photo = () => new File(['x'], 'cake.jpg', { type: 'image/jpeg' });

describe('AddPost', () => {
  beforeEach(() => {
    addDoc.mockClear();
    uploadBytes.mockClear();
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(cleanup);

  it('shows a preview of the chosen photo before saving', async () => {
    render(<AddPost user={user} />);
    pickFile(photo());
    expect(await screen.findByAltText('Preview of your photo')).toBeTruthy();
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('saves one scheduled post with caption, accounts and time for a valid form', async () => {
    render(<AddPost user={user} />);
    pickFile(photo());
    await screen.findByAltText('Preview of your photo');
    fireEvent.change(screen.getByLabelText('Caption'), { target: { value: 'Fresh bread' } });
    fireEvent.click(screen.getByLabelText('Instagram @bakery_ig'));
    fireEvent.click(screen.getByLabelText('Facebook Page Bakery'));
    fireEvent.change(screen.getByLabelText(/Date and time/), { target: { value: future } });
    fireEvent.click(screen.getByRole('button', { name: 'Schedule post' }));
    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));
    const saved = (addDoc.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(saved).toMatchObject({
      uid: 'user-1',
      caption: 'Fresh bread',
      accountIds: ['a1', 'a2'],
      mediaType: 'image',
      status: 'scheduled',
    });
    expect(saved.scheduledAt).toEqual(new Date(future));
  });

  it('blocks saving without media, account or time and says what is missing', () => {
    render(<AddPost user={user} />);
    fireEvent.click(screen.getByRole('button', { name: 'Schedule post' }));
    expect(screen.getByText('Add a photo or video.')).toBeTruthy();
    expect(screen.getByText('Choose at least one account to post to.')).toBeTruthy();
    expect(screen.getByText('Choose a date and time.')).toBeTruthy();
    expect(addDoc).not.toHaveBeenCalled();
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it('blocks saving with a time in the past', async () => {
    render(<AddPost user={user} />);
    pickFile(photo());
    await screen.findByAltText('Preview of your photo');
    fireEvent.click(screen.getByLabelText('Instagram @bakery_ig'));
    fireEvent.change(screen.getByLabelText(/Date and time/), { target: { value: '2000-01-01T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Schedule post' }));
    expect(screen.getByText('The date and time must be in the future.')).toBeTruthy();
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('refuses a file of the wrong format with a reason', async () => {
    render(<AddPost user={user} />);
    pickFile(new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText(/file type is not accepted/)).toBeTruthy();
    expect(screen.queryByAltText('Preview of your photo')).toBeNull();
  });

  it('refuses a video longer than 60 seconds with a reason', async () => {
    const original = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = original(tag);
      if (tag === 'video') {
        Object.defineProperty(el, 'duration', { value: 61 });
        Object.defineProperty(el, 'src', {
          set() {
            queueMicrotask(() => (el as HTMLVideoElement).onloadedmetadata?.(new Event('loadedmetadata')));
          },
        });
      }
      return el;
    });
    render(<AddPost user={user} />);
    pickFile(new File(['x'], 'clip.mp4', { type: 'video/mp4' }));
    expect(await screen.findByText(/longer than 60 seconds/)).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('refuses a photo that is too large with a reason', async () => {
    render(<AddPost user={user} />);
    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 9 * 1024 * 1024 });
    pickFile(big);
    expect(await screen.findByText(/larger than 8 MB/)).toBeTruthy();
  });
});
