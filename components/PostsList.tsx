'use client';

import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useMemo, useState } from 'react';

import { getFirebase } from '@/lib/firebase';
import { checkMedia, isVideo } from '@/lib/postMedia';

type PostStatus = 'scheduled' | 'publishing' | 'published' | 'failed';

interface Account {
  docId: string;
  label: string;
}

interface Post {
  id: string;
  caption: string;
  mediaUrl: string;
  mediaPath: string;
  mediaType: 'image' | 'video';
  accountIds: string[];
  scheduledAt: Date;
  status: PostStatus;
}

function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const STATUS_LABEL: Record<PostStatus, string> = {
  scheduled: 'Scheduled',
  publishing: 'Publishing',
  published: 'Published',
  failed: 'Failed',
};

/**
 * Lists the signed-in person's posts. A scheduled post can be opened, edited
 * and deleted; a published post can only be viewed, since posting.rules
 * closes writes once a post leaves the "scheduled" status.
 */
export default function PostsList({ user }: { user: User }) {
  const uid = user.uid;
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Post | null>(null);
  const [editing, setEditing] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState<Post | null>(null);

  useEffect(() => {
    const postsQuery = query(collection(getFirebase().db, 'posts'), where('uid', '==', uid));
    return onSnapshot(
      postsQuery,
      (snapshot) => {
        setLoadError(null);
        setPosts(
          snapshot.docs
            .map((d) => {
              const data = d.data() as {
                caption?: string;
                mediaUrl?: string;
                mediaPath?: string;
                mediaType?: 'image' | 'video';
                accountIds?: string[];
                scheduledAt?: Timestamp | Date | null;
                status?: PostStatus;
              };
              const scheduledAt = data.scheduledAt
                ? 'toDate' in data.scheduledAt
                  ? data.scheduledAt.toDate()
                  : (data.scheduledAt as Date)
                : new Date();
              return {
                id: d.id,
                caption: data.caption ?? '',
                mediaUrl: data.mediaUrl ?? '',
                mediaPath: data.mediaPath ?? '',
                mediaType: data.mediaType ?? 'image',
                accountIds: data.accountIds ?? [],
                scheduledAt,
                status: data.status ?? 'scheduled',
              };
            })
            .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()),
        );
      },
      () => setLoadError('We could not load your posts. Please try again.'),
    );
  }, [uid]);

  useEffect(() => {
    const q = query(collection(getFirebase().db, 'connectedAccounts'), where('uid', '==', uid));
    return onSnapshot(q, (snapshot) =>
      setAccounts(
        snapshot.docs.map((d) => {
          const data = d.data() as { provider: string; name?: string; username?: string };
          return {
            docId: d.id,
            label:
              data.provider === 'instagram'
                ? `Instagram @${data.username}`
                : `Facebook Page ${data.name}`,
          };
        }),
      ),
    );
  }, [uid]);

  return (
    <section aria-labelledby="posts-heading" className="flex flex-col gap-3">
      <h2 id="posts-heading" className="text-xl font-semibold">
        Your posts
      </h2>
      {loadError ? <p role="alert">{loadError}</p> : null}
      {posts.length === 0 ? <p>You have no posts yet. Schedule a post to see it here.</p> : null}
      <ul className="flex flex-col gap-2">
        {posts.map((post) => (
          <li key={post.id} className="flex items-center gap-3 rounded border p-2">
            <button
              type="button"
              className="flex-1 text-left"
              onClick={() => (post.status === 'scheduled' ? setEditing(post) : setViewing(post))}
            >
              <span className="block">{post.caption || '(No caption)'}</span>
              <span className="block text-sm">{post.scheduledAt.toLocaleString()}</span>
            </button>
            <span className="rounded-full border px-2 py-0.5 text-sm">
              {STATUS_LABEL[post.status]}
            </span>
            {post.status === 'scheduled' ? (
              <>
                <button
                  type="button"
                  aria-label={`Edit post scheduled for ${post.scheduledAt.toLocaleString()}`}
                  className="rounded border px-2 py-1"
                  onClick={() => setEditing(post)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  aria-label={`Delete post scheduled for ${post.scheduledAt.toLocaleString()}`}
                  className="rounded border px-2 py-1"
                  onClick={() => setDeleting(post)}
                >
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  title="Published posts can't be edited"
                  className="rounded border px-2 py-1 opacity-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled
                  title="Published posts can't be deleted"
                  className="rounded border px-2 py-1 opacity-50"
                >
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {viewing ? <ViewPostDialog post={viewing} onClose={() => setViewing(null)} /> : null}

      {editing ? (
        <EditPostDialog
          post={editing}
          uid={uid}
          accounts={accounts}
          onClose={() => setEditing(null)}
          onDelete={() => {
            setDeleting(editing);
            setEditing(null);
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteConfirmDialog post={deleting} onClose={() => setDeleting(null)} />
      ) : null}
    </section>
  );
}

function ViewPostDialog({ post, onClose }: { post: Post; onClose: () => void }) {
  return (
    <div role="dialog" aria-label="View post" className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="flex max-w-sm flex-col gap-3 rounded bg-white p-4 text-black">
        <h3 className="text-lg font-semibold">Published post</h3>
        {post.mediaType === 'video' ? (
          <video src={post.mediaUrl} controls className="max-w-xs" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.mediaUrl} alt="" className="max-w-xs" />
        )}
        <p>{post.caption}</p>
        <p className="text-sm">{post.scheduledAt.toLocaleString()}</p>
        <button type="button" className="w-fit rounded border px-3 py-1" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function EditPostDialog({
  post,
  uid,
  accounts,
  onClose,
  onDelete,
}: {
  post: Post;
  uid: string;
  accounts: Account[];
  onClose: () => void;
  onDelete: () => void;
}) {
  const [caption, setCaption] = useState(post.caption);
  const [selected, setSelected] = useState<string[]>(post.accountIds);
  const [when, setWhen] = useState(toDateTimeLocal(post.scheduledAt));
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const original = useMemo(
    () => ({ caption: post.caption, selected: post.accountIds, when: toDateTimeLocal(post.scheduledAt) }),
    [post],
  );
  const changed =
    caption !== original.caption ||
    when !== original.when ||
    file !== null ||
    selected.length !== original.selected.length ||
    selected.some((id) => !original.selected.includes(id));

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((a) => a !== id) : [...current, id]));
  }

  async function chooseFile(chosen: File | undefined) {
    setMediaError(null);
    setFile(null);
    setPreviewUrl(null);
    if (!chosen) return;
    const problem = await checkMedia(chosen);
    if (problem) setMediaError(problem);
    else {
      setFile(chosen);
      setPreviewUrl(URL.createObjectURL(chosen));
    }
  }

  async function save() {
    const missing: string[] = [];
    if (selected.length === 0) missing.push('Choose at least one account to post to.');
    const scheduledAt = when ? new Date(when) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) missing.push('Choose a date and time.');
    setErrors(missing);
    if (missing.length > 0 || !scheduledAt) return;

    setBusy(true);
    try {
      const { db, storage } = getFirebase();
      const update: Record<string, unknown> = {
        caption,
        accountIds: selected,
        scheduledAt,
      };
      if (file) {
        const path = `posts/${uid}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`;
        const mediaRef = ref(storage, path);
        await uploadBytes(mediaRef, file, { contentType: file.type });
        update.mediaUrl = await getDownloadURL(mediaRef);
        update.mediaPath = path;
        update.mediaType = isVideo(file) ? 'video' : 'image';
      }
      await updateDoc(doc(db, 'posts', post.id), update);
      onClose();
    } catch {
      setErrors(['We could not save your changes. Please try again.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-label="Edit post" className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="flex max-w-sm flex-col gap-3 rounded bg-white p-4 text-black">
        <h3 className="text-lg font-semibold">Edit post</h3>
        {previewUrl ? (
          file && isVideo(file) ? (
            <video src={previewUrl} controls className="max-w-xs" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="New media preview" className="max-w-xs" />
          )
        ) : post.mediaType === 'video' ? (
          <video src={post.mediaUrl} controls className="max-w-xs" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.mediaUrl} alt="Current media" className="max-w-xs" />
        )}
        <label className="flex flex-col gap-1">
          Replace photo or video
          <input
            type="file"
            accept="image/jpeg,image/png,video/mp4,video/quicktime"
            onChange={(e) => void chooseFile(e.target.files?.[0])}
          />
        </label>
        {mediaError ? <p role="alert">{mediaError}</p> : null}
        <label className="flex flex-col gap-1">
          Caption
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="rounded border px-2 py-1"
          />
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend>Post to</legend>
          {accounts.map((account) => (
            <label key={account.docId} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(account.docId)}
                onChange={() => toggle(account.docId)}
              />
              {account.label}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-1">
          Date and time
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-fit rounded border px-2 py-1"
          />
        </label>
        {errors.length > 0 ? (
          <ul role="alert" className="list-disc pl-5">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!changed || busy}
            className="rounded border px-3 py-1"
            onClick={() => void save()}
          >
            Save changes
          </button>
          <button type="button" className="rounded border px-3 py-1" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ml-auto rounded border px-3 py-1 text-red-700" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmDialog({ post, onClose }: { post: Post; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setBusy(true);
    try {
      await deleteDoc(doc(getFirebase().db, 'posts', post.id));
      onClose();
    } catch {
      setError('We could not delete this post. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Delete this scheduled post?"
      className="fixed inset-0 flex items-center justify-center bg-black/50"
    >
      <div className="flex max-w-sm flex-col gap-3 rounded bg-white p-4 text-black">
        <h3 className="text-lg font-semibold">Delete this scheduled post?</h3>
        <p>
          This post is scheduled for {post.scheduledAt.toLocaleString()}. Deleting it means it won&apos;t be
          published.
        </p>
        {error ? <p role="alert">{error}</p> : null}
        <div className="flex gap-2">
          <button type="button" autoFocus disabled={busy} className="rounded border px-3 py-1" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded border px-3 py-1 text-red-700"
            onClick={() => void confirmDelete()}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
