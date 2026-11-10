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

interface InstagramAccount {
  id: string;
  username: string;
}

interface ConnectedAccount extends InstagramAccount {
  docId: string;
}

interface GraphPage {
  id: string;
  name: string;
  instagram_business_account?: { id: string; username?: string };
}

const GRAPH_ACCOUNTS_URL =
  'https://graph.facebook.com/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=';

async function getAccessToken(user: User): Promise<string> {
  const provider = new FacebookAuthProvider();
  provider.addScope('pages_show_list');
  provider.addScope('instagram_basic');
  provider.addScope('instagram_content_publish');
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
 * Lets a signed-in person connect Instagram business or creator accounts that are
 * linked to a Facebook Page. Only the account id and username are stored in
 * `connectedAccounts` (owner-only in `firestore.rules`); no token is saved.
 */
export default function ConnectInstagram({ user }: { user: User }) {
  const uid = user.uid;
  const [connected, setConnected] = useState<ConnectedAccount[]>([]);
  const [available, setAvailable] = useState<InstagramAccount[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accounts = query(
      collection(getFirebase().db, 'connectedAccounts'),
      where('uid', '==', uid),
      where('provider', '==', 'instagram'),
    );
    return onSnapshot(
      accounts,
      (snapshot) =>
        setConnected(
          snapshot.docs.map((d) => {
            const data = d.data() as { accountId: string; username: string };
            return { docId: d.id, id: data.accountId, username: data.username };
          }),
        ),
      () => setError('We could not load your connected Instagram accounts. Please try again.'),
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
      const body = (await response.json()) as { data?: GraphPage[] };
      const accounts = (body.data ?? []).flatMap((page) =>
        page.instagram_business_account
          ? [
              {
                id: page.instagram_business_account.id,
                username: page.instagram_business_account.username ?? page.name,
              },
            ]
          : [],
      );
      if (accounts.length === 0) {
        setError(
          'We found no Instagram business or creator account linked to a Facebook Page, so nothing was connected. ' +
            'Instagram only allows scheduled publishing for these account types. To switch a personal account, ' +
            'open Instagram, go to Settings, choose Account type and tools, and switch to a professional account. ' +
            'Then link it to a Facebook Page and try again.',
        );
      } else {
        setAvailable(accounts);
      }
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(
        code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request' ||
          code === 'auth/user-cancelled' ||
          code === 'auth/popup-blocked'
          ? 'Instagram access was cancelled or refused, so nothing was connected.'
          : 'We could not connect to Instagram, so nothing was connected. Please try again.',
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
      for (const account of (available ?? []).filter((a) => selected.includes(a.id))) {
        await setDoc(doc(getFirebase().db, 'connectedAccounts', `${uid}_instagram_${account.id}`), {
          uid,
          provider: 'instagram',
          accountId: account.id,
          username: account.username,
          createdAt: serverTimestamp(),
        });
      }
      setAvailable(null);
      setSelected([]);
    } catch {
      setError('We could not connect that Instagram account. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(account: ConnectedAccount) {
    try {
      await deleteDoc(doc(getFirebase().db, 'connectedAccounts', account.docId));
    } catch {
      setError(`We could not disconnect @${account.username}. Please try again.`);
    }
  }

  return (
    <section aria-labelledby="instagram-heading" className="flex flex-col gap-3">
      <h2 id="instagram-heading" className="text-xl font-semibold">
        Instagram
      </h2>
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        className="w-fit rounded border px-3 py-1"
      >
        Connect Instagram
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {available ? (
        <fieldset className="flex flex-col gap-2">
          <legend>Choose the Instagram accounts to connect</legend>
          {available.map((account) => (
            <label key={account.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(account.id)}
                onChange={() => toggle(account.id)}
              />
              @{account.username}
            </label>
          ))}
          <button
            type="button"
            onClick={() => void connectSelected()}
            disabled={busy || selected.length === 0}
            className="w-fit rounded border px-3 py-1"
          >
            Connect selected accounts
          </button>
        </fieldset>
      ) : null}
      <h3 className="font-semibold">Connected Instagram accounts</h3>
      {connected.length === 0 ? (
        <p>No Instagram accounts connected.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {connected.map((account) => (
            <li key={account.docId} className="flex justify-between gap-2">
              <span>@{account.username}</span>
              <button
                type="button"
                className="underline"
                onClick={() => void disconnect(account)}
                aria-label={`Disconnect @${account.username}`}
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
