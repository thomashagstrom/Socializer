import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PostsList from './PostsList';

const updateDoc = vi.fn(async () => ({}));
const deleteDoc = vi.fn(async () => ({}));
const uploadBytes = vi.fn(async () => ({}));

const scheduledPost = {
  id: 'post-1',
  data: () => ({
    caption: 'Fresh bread',
    mediaUrl: 'https://example.test/bread.jpg',
    mediaPath: 'posts/user-1/bread.jpg',
    mediaType: 'image',
    accountIds: ['a1'],
    scheduledAt: new Date('2999-01-01T10:00:00'),
    status: 'scheduled',
  }),
};

const publishedPost = {
  id: 'post-2',
  data: () => ({
    caption: 'Old croissants',
    mediaUrl: 'https://example.test/croissant.jpg',
    mediaPath: 'posts/user-1/croissant.jpg',
    mediaType: 'image',
    accountIds: ['a1'],
    scheduledAt: new Date('2020-01-01T10:00:00'),
    status: 'published',
  }),
};

let docs = [scheduledPost];

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  doc: (_db: unknown, _col: string, id: string) => ({ id }),
  updateDoc: (...args: unknown[]) => updateDoc(...(args as [])),
  deleteDoc: (...args: unknown[]) => deleteDoc(...(args as [])),
  onSnapshot: (q: unknown, next: (s: { docs: unknown[] }) => void) => {
    next({ docs: q === 'accounts' ? [] : docs });
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

describe('PostsList', () => {
  beforeEach(() => {
    updateDoc.mockClear();
    deleteDoc.mockClear();
    uploadBytes.mockClear();
  });
  afterEach(cleanup);

  it('edits a scheduled post and saves the change', async () => {
    docs = [scheduledPost];
    render(<PostsList user={user} />);
    fireEvent.click(screen.getByRole('button', { name: /Edit post scheduled for/ }));
    const captionField = screen.getByLabelText('Caption');
    fireEvent.change(captionField, { target: { value: 'Fresh sourdough' } });
    const saveButton = screen.getByRole('button', { name: 'Save changes' });
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);
    await waitFor(() => expect(updateDoc).toHaveBeenCalledTimes(1));
    const update = (updateDoc.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(update).toMatchObject({ caption: 'Fresh sourdough' });
  });

  it('deletes a scheduled post after confirming, so it is not published', async () => {
    docs = [scheduledPost];
    render(<PostsList user={user} />);
    fireEvent.click(screen.getByRole('button', { name: /Delete post scheduled for/ }));
    expect(screen.getByRole('dialog', { name: 'Delete this scheduled post?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleteDoc).toHaveBeenCalledTimes(1));
  });

  it('does not show edit or delete controls for a published post', () => {
    docs = [publishedPost];
    render(<PostsList user={user} />);
    expect(screen.queryByRole('button', { name: /Edit post scheduled for/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete post scheduled for/ })).toBeNull();
    const editButton = screen.getByRole('button', { name: 'Edit' });
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(editButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
    fireEvent.click(screen.getByText('Old croissants'));
    expect(screen.getByRole('dialog', { name: 'View post' })).toBeTruthy();
    expect(updateDoc).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});
