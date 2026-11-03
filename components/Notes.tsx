'use client';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { useEffect, useState, type FormEvent } from 'react';

import { getFirebase } from '@/lib/firebase';

interface Note {
  id: string;
  text: string;
  createdAt: number;
}

/**
 * A working Firestore read/write to build from: each signed-in person has their
 * own notes, and `firestore.rules` lets them touch only those.
 */
export default function Notes({ uid }: { uid: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Sorted here, not with orderBy(): a where() on uid plus an orderBy() on a
    // second field needs a composite index, and this starting point has none.
    const notesQuery = query(collection(getFirebase().db, 'notes'), where('uid', '==', uid));
    return onSnapshot(
      notesQuery,
      (snapshot) => {
        setError(null);
        setNotes(
          snapshot.docs
            .map((d) => {
              const data = d.data() as { text?: string; createdAt?: Timestamp | null };
              return {
                id: d.id,
                text: data.text ?? '',
                // A just-written note has no server timestamp yet.
                createdAt: data.createdAt?.toMillis() ?? Date.now(),
              };
            })
            .sort((a, b) => b.createdAt - a.createdAt),
        );
      },
      () => setError('We could not load your notes. Check your connection and try again.'),
    );
  }, [uid]);

  async function add(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    try {
      await addDoc(collection(getFirebase().db, 'notes'), {
        uid,
        text: value,
        createdAt: serverTimestamp(),
      });
    } catch {
      setError('We could not save that note. Please try again.');
    }
  }

  return (
    <section className="flex max-w-sm flex-col gap-3">
      <form onSubmit={add} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a note"
          className="flex-1 rounded border px-2 py-1 text-black"
        />
        <button type="submit" className="rounded border px-3 py-1">
          Add
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <ul className="flex flex-col gap-1">
        {notes.map((note) => (
          <li key={note.id} className="flex justify-between gap-2">
            <span>{note.text}</span>
            <button
              className="underline"
              onClick={() => void deleteDoc(doc(getFirebase().db, 'notes', note.id))}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
