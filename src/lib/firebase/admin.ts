import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;

function getAdminApp(): App {
  if (app) return app;
  const apps = getApps();
  if (apps.length > 0) {
    app = apps[0];
    return app;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // In Cloud Run (Firebase App Hosting), K_SERVICE is set automatically.
  // Use Application Default Credentials — the attached service account
  // (firebase-app-hosting-compute@...) already has Firebase Admin access.
  // No secret management needed in production.
  if (process.env.K_SERVICE) {
    app = initializeApp({ projectId });
    return app;
  }

  // Local dev: require explicit service account credentials in .env.local
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    const missing = [
      !clientEmail && "FIREBASE_ADMIN_CLIENT_EMAIL",
      !privateKey && "FIREBASE_ADMIN_PRIVATE_KEY",
    ].filter(Boolean).join(", ");
    throw new Error(
      `Firebase Admin SDK is not configured. Missing env vars: ${missing}. ` +
      `Add them to .env.local for local development.`
    );
  }

  // Strip surrounding JSON quotes if accidentally included, then fix \n escapes.
  let parsedKey = privateKey.trim();
  if (parsedKey.startsWith('"') && parsedKey.endsWith('"')) {
    parsedKey = parsedKey.slice(1, -1);
  }
  parsedKey = parsedKey.replace(/\\n/g, "\n");

  app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey: parsedKey }),
  });
  return app;
}

function lazyProxy<T extends object>(getReal: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const real = getReal();
      const value = Reflect.get(real as object, prop);
      return typeof value === "function" ? value.bind(real) : value;
    },
  });
}

export const adminAuth: Auth = lazyProxy(() => getAuth(getAdminApp()));
export const adminDb: Firestore = lazyProxy(() => getFirestore(getAdminApp()));
