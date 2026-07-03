"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { UserRole } from "@/types";

interface AuthState {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  loading: true,
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, role: null, loading: false, error: null });
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists() || snap.data().active === false) {
        await signOut(auth);
        setState({
          user: null,
          role: null,
          loading: false,
          error: "This account has not been set up yet. Contact your Admin.",
        });
        return;
      }

      await setDoc(userRef, { lastLoginAt: Timestamp.now() }, { merge: true });
      setState({ user, role: snap.data().role as UserRole, loading: false, error: null });
    });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
