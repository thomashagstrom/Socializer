import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

// Read as literal `process.env.NEXT_PUBLIC_*` expressions on purpose: Next.js
// only inlines them into the browser bundle when spelled out like this.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'demo-app.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-app',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? 'demo-app-id',
};

/**
 * With no real project configured the app runs against the local emulators
 * (`npm run emulators`). The `demo-` project id keeps them from ever reaching
 * a real Firebase project.
 */
export const usingEmulators = !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

export interface FirebaseClients {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let clients: FirebaseClients | undefined;

/**
 * The Firebase clients, created on first use. Call this from an effect or an
 * event handler, never at module scope, so nothing runs during the server
 * prerender.
 */
export function getFirebase(): FirebaseClients {
  if (clients) return clients;
  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (usingEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8081);
  }
  clients = { app, auth, db };
  return clients;
}
