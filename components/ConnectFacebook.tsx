'use client';

import {
  FacebookAuthProvider,
  linkWithPopup,
  reauthenticateWithPopup,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { getFirebase } from '@/lib/firebase';

interface Page {
  id: string;
  name: string;
}

interface ConnectedPage extends Page {
  docId: string;
}

const GRAPH_ACCOUNTS_URL = 'https://graph.facebook.com/me/accounts?fields=id,name&access_token=';

async function getAccessToken(user: User): Promise<string> {
  const provider = new FacebookAuthProvider();
  provider.addScope('pages_show_list');
  provider.addScope('pages_manage_posts');
  let result;
  try {
    result = await linkWithPopup(user, provider);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/provider-already-linked') throw error;
    result = await reauthenticateWithPopup(user, provider);
  }
  const token = FacebookAuthProvider.credentialFromResult(result)?.accessToken;
  if (!token) throw new Error('no-token');
  return token;
}

/**
 * Lets a signed-in person connect Facebook Pages. Only the Page id and name are
 * stored in `connectedAccounts` (owner-only in `firestore.rules`); no Facebook
 * token is saved.
 */
export default function ConnectFacebook({ user }: { user: User }) {
  const uid = user.uid;
  const [connected, setConnected] = useState<ConnectedPage[]>([]);
  const [available, setAvailable] = useState<Page[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accounts = query(
      collection(getFirebase().db, 'connectedAccounts'),
      where('uid', '==', uid),
      where('provider', '==', 'facebook'),
    );
    return onSnapshot(
      accounts,
      (snapshot) =>
        setConnected(
          snapshot.docs.map((d) => {
            const data = d.data() as { pageId: string; name: string };
            return { docId: d.id, id: data.pageId, name: data.name };
          }),
        ),
      () => setError('We could not load your connected Pages. Please try again.'),
    );
  }, [uid]);

  async function start() {
    setError(null);
    setAvailable(null);
    setSelected([]);
    setBusy(true);
    try {
      const token = await getAccessToken(user);
      const response = await fetch(GRAPH_ACCOUNTS_URL + encodeURIComponent(token));
      if (!response.ok) throw new Error('graph');
      const body = (await response.json()) as { data?: Page[] };
      const pages = body.data ?? [];
      if (pages.length === 0) {
        setError('No Facebook Pages were found for your account, so nothing was connected.');
      } else {
        setAvailable(pages);
      }
    } catch (e) {
  console.error('Facebook connect failed', e);
      const code = (e as { code?: string }).code;
      setError(
        code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request' ||
          code === 'auth/user-cancelled' ||
          code === 'auth/popup-blocked'
          ? 'Facebook access was cancelled or refused, so nothing was connected.'
          : 'We could not connect to Facebook, so nothing was connected. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    );
  }

  async function connectSelected() {
    setBusy(true);
    try {
      for (const page of (available ?? []).filter((p) => selected.includes(p.id))) {
        await setDoc(doc(getFirebase().db, 'connectedAccounts', `${uid}_facebook_${page.id}`), {
          uid,
          provider: 'facebook',
          pageId: page.id,
          name: page.name,
          createdAt: serverTimestamp(),
        });
      }
      setAvailable(null);
      setSelected([]);
    } catch {
      setError('We could not connect that Page. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(page: ConnectedPage) {
    try {
      await deleteDoc(doc(getFirebase().db, 'connectedAccounts', page.docId));
    } catch {
      setError(`We could not disconnect ${page.name}. Please try again.`);
    }
  }

  return (
    <section aria-labelledby="facebook-heading" className="flex flex-col gap-3">
      <h2 id="facebook-heading" className="text-xl font-semibold">
        Facebook
      </h2>
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        className="w-fit rounded border px-3 py-1"
      >
        Connect Facebook
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {available ? (
        <fieldset className="flex flex-col gap-2">
          <legend>Choose the Pages to connect</legend>
          {available.map((page) => (
            <label key={page.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(page.id)}
                onChange={() => toggle(page.id)}
              />
              {page.name}
            </label>
          ))}
          <button
            type="button"
            onClick={() => void connectSelected()}
            disabled={busy || selected.length === 0}
            className="w-fit rounded border px-3 py-1"
          >
            Connect selected Pages
          </button>
        </fieldset>
      ) : null}
      <h3 className="font-semibold">Connected Pages</h3>
      {connected.length === 0 ? (
        <p>No Facebook Pages connected.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {connected.map((page) => (
            <li key={page.docId} className="flex justify-between gap-2">
              <span>{page.name}</span>
              <button
                type="button"
                className="underline"
                onClick={() => void disconnect(page)}
                aria-label={`Disconnect ${page.name}`}
              >
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
