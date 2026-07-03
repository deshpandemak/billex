BillEx is a Government Pleader office billing application built on Next.js and Firebase (Auth, Firestore, Storage).

See [`docs/SPEC.md`](docs/SPEC.md) for the roles, designations, fee schedule, and board-data workflow this app implements.

## Getting Started

Set up `.env.local` with your Firebase project config:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
```

The `FIREBASE_ADMIN_*` variables (a service account) are required for the Admin-only login-provisioning API route at `/api/admin/users`.

Then run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first Admin login must be created directly in Firestore (`users/{uid}` with `role: "admin"`) since account creation is otherwise Admin-only; every subsequent login is created from `/admin/users`.

## Deploying Firestore rules & indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```
