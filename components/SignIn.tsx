'use client';

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { useState, type FormEvent } from 'react';

import { getFirebase } from '@/lib/firebase';

/** Plain sentences for the errors people actually hit, never Firebase's raw text. */
function friendlyError(error: unknown): string | null {
  switch ((error as { code?: string }).code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return "That email and password don't match.";
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.';
    case 'auth/invalid-email':
      return 'That email address does not look right.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null; // They changed their mind. Not an error.
    default:
      return 'Something went wrong. Please try again.';
  }
}

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  function signIn(event: FormEvent) {
    event.preventDefault();
    void run(() => signInWithEmailAndPassword(getFirebase().auth, email, password));
  }

  return (
    <form onSubmit={signIn} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-2 py-1 text-black"
        />
      </label>
      <label className="flex flex-col gap-1">
        Password
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-2 py-1 text-black"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="rounded border px-3 py-1">
          Sign in
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded border px-3 py-1"
          onClick={() =>
            void run(() => createUserWithEmailAndPassword(getFirebase().auth, email, password))
          }
        >
          Create account
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded border px-3 py-1"
          onClick={() =>
            void run(() => signInWithPopup(getFirebase().auth, new GoogleAuthProvider()))
          }
        >
          Continue with Google
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
