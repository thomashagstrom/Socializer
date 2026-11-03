'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import SignIn from '@/components/SignIn';
import { getFirebase } from '@/lib/firebase';

export default function SignInPage() {
  const [signedIn, setSignedIn] = useState(false);
  const router = useRouter();

  useEffect(
    () =>
      onAuthStateChanged(getFirebase().auth, (user) => {
        if (user) {
          setSignedIn(true);
          router.replace('/calendar');
        }
      }),
    [router],
  );

  if (signedIn) return <p>Loading…</p>;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <SignIn />
    </main>
  );
}
