This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Firebase App Hosting

This app goes live on Firebase App Hosting, not Vercel: once a Firebase project is
connected, every change merged to the main branch goes online by itself. See the
Firebase section below.

## Firebase

This app is wired to **Cloud Firestore** and **Firebase Authentication** and runs
against the local emulators until a real Firebase project is connected.

```bash
npm run emulators   # Auth on :9099, Firestore on :8081, dashboard on :4000
npm run dev         # in a second terminal
```

- `lib/firebase.ts` builds the Firebase clients. With no
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID` set it uses the emulators.
- `firestore.rules` is the security policy. It is closed by default: each signed-in
  person can read and write only their own `notes`. Open a new path on purpose, and
  review every change to this file.
- `apphosting.yaml` sets the limits for Firebase App Hosting, where this app is
  deployed once a Firebase project is connected.
