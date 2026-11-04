'use client';

import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { getFirebase } from '@/lib/firebase';

/**
 * Renders `children` once someone is signed in. A signed-out visitor is sent
 * to the sign-in page instead of seeing the protected content.
 */
export default function AuthGate({ children }: { children: (user: User) => ReactNode }) {
  // undefined = still finding out, null = signed out.
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => onAuthStateChanged(getFirebase().auth, setUser), []);

  useEffect(() => {
    if (user === null) router.replace('/sign-in');
  }, [user, router]);

  if (user === undefined || user === null) return <p>Loading…</p>;
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
