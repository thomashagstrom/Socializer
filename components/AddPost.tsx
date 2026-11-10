'use client';

import type { User } from 'firebase/auth';
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';

import { getFirebase } from '@/lib/firebase';
import { checkMedia, isVideo } from '@/lib/postMedia';

interface Account {
  docId: string;
  label: string;
}

/**
 * Lets a signed-in person add one photo or short video with a caption and
 * schedule it for a future date and time in their own time zone. Media goes to
 * Storage under `posts/<uid>/`; the post is saved in `posts` with status
 * "scheduled".
 */
export default function AddPost({ user }: { user: User }) {
  const uid = user.uid;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [when, setWhen] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  useEffect(() => {
    const q = query(collection(getFirebase().db, 'connectedAccounts'), where('uid', '==', uid));
    return onSnapshot(
      q,
      (snapshot) =>
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
      () => setErrors(['We could not load your connected accounts. Please try again.']),
    );
  }, [uid]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function chooseFile(chosen: File | undefined) {
    setSaved(false);
    setMediaError(null);
    setFile(null);
    if (!chosen) return;
    const problem = await checkMedia(chosen);
    if (problem) setMediaError(problem);
    else setFile(chosen);
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((a) => a !== id) : [...current, id],
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    const missing: string[] = [];
    if (!file) missing.push('Add a photo or video.');
    if (selected.length === 0) missing.push('Choose at least one account to post to.');
    const scheduledAt = when ? new Date(when) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) missing.push('Choose a date and time.');
    else if (scheduledAt.getTime() <= Date.now()) {
      missing.push('The date and time must be in the future.');
    }
    setErrors(missing);
    if (missing.length > 0 || !file || !scheduledAt) return;

    setBusy(true);
    try {
      const { db, storage } = getFirebase();
      const path = `posts/${uid}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const mediaRef = ref(storage, path);
      await uploadBytes(mediaRef, file, { contentType: file.type });
      const mediaUrl = await getDownloadURL(mediaRef);
      await addDoc(collection(db, 'posts'), {
        uid,
        caption,
        mediaPath: path,
        mediaUrl,
        mediaType: isVideo(file) ? 'video' : 'image',
        accountIds: selected,
        scheduledAt,
        timeZone,
        status: 'scheduled',
        createdAt: serverTimestamp(),
      });
      setFile(null);
      setCaption('');
      setSelected([]);
      setWhen('');
      setSaved(true);
    } catch {
      setErrors(['We could not save your post. Please try again.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="add-post-heading" className="flex flex-col gap-3">
      <h2 id="add-post-heading" className="text-xl font-semibold">
        Add a post
      </h2>
      <form onSubmit={(e) => void save(e)} noValidate className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          Photo or video (JPG, PNG, MP4 or MOV, up to 60 seconds)
          <input
            type="file"
            accept="image/jpeg,image/png,video/mp4,video/quicktime"
            onChange={(e) => void chooseFile(e.target.files?.[0])}
          />
        </label>
        {mediaError ? <p role="alert">{mediaError}</p> : null}
        {file && previewUrl ? (
          isVideo(file) ? (
            <video src={previewUrl} controls aria-label="Preview of your video" className="max-w-sm" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Preview of your photo" className="max-w-sm" />
          )
        ) : null}
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
          {accounts.length === 0 ? <p>Connect a Facebook Page or Instagram account first.</p> : null}
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
          Date and time{timeZone ? ` (${timeZone})` : ''}
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
        {saved ? <p role="status">Your post is scheduled.</p> : null}
        <button type="submit" disabled={busy} className="w-fit rounded border px-3 py-1">
          Schedule post
        </button>
      </form>
    </section>
  );
}
