'use client';

import AuthGate from './AuthGate';
import AddPost from './AddPost';
import ConnectFacebook from './ConnectFacebook';
import ConnectInstagram from './ConnectInstagram';
import Notes from './Notes';

export default function App() {
  return (
    <AuthGate>
      {(user) => (
        <div className="flex flex-col gap-8">
          <ConnectFacebook user={user} />
          <ConnectInstagram user={user} />
          <AddPost user={user} />
          <Notes uid={user.uid} />
        </div>
      )}
    </AuthGate>
  );
}
