'use client';

import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useEffect, useState, type ReactNode } from 'react';

import { getFirebase } from '@/lib/firebase';

import SignIn from './SignIn';

/** Shows the sign-in form until someone is signed in, then renders `children`. */
export default function AuthGate({ children }: { children: (user: User) => ReactNode }) {
  // undefined = still finding out, null = signed out.
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(getFirebase().auth, setUser), []);

  if (user === undefined) return <p>Loading…</p>;
  if (user === null) return <SignIn />;
  return (
    <>
      <p className="mb-4">
        Signed in as {user.email ?? user.uid}{' '}
        <button className="underline" onClick={() => void signOut(getFirebase().auth)}>
          Sign out
        </button>
      </p>
      {children(user)}
    </>
  );
}
