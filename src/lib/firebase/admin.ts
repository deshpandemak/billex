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
  app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
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
