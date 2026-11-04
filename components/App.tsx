'use client';

import AuthGate from './AuthGate';
import ConnectFacebook from './ConnectFacebook';
import Notes from './Notes';

export default function App() {
  return (
    <AuthGate>
      {(user) => (
        <div className="flex flex-col gap-8">
          <ConnectFacebook user={user} />
          <Notes uid={user.uid} />
        </div>
      )}
    </AuthGate>
  );
}
