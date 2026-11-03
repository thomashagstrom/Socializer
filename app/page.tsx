import App from '@/components/App';

export default function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Your app</h1>
      <p>
        Sign in, then add a note. It is saved to Firestore under your account, and only you can
        read it.
      </p>
      <App />
    </main>
  );
}
