'use client';

import AuthGate from './AuthGate';
import Notes from './Notes';

export default function App() {
  return <AuthGate>{(user) => <Notes uid={user.uid} />}</AuthGate>;
}
