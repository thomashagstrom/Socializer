'use client';

import AuthGate from './AuthGate';
import AddPost from './AddPost';
import ConnectFacebook from './ConnectFacebook';
import ConnectInstagram from './ConnectInstagram';
import Notes from './Notes';
import PostsList from './PostsList';

export default function App() {
  return (
    <AuthGate>
      {(user) => (
        <div className="flex flex-col gap-8">
          <ConnectFacebook user={user} />
          <ConnectInstagram user={user} />
          <AddPost user={user} />
          <PostsList user={user} />
          <Notes uid={user.uid} />
        </div>
      )}
    </AuthGate>
  );
}
