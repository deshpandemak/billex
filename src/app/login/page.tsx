"use client";

import { useState } from "react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const { error: sessionError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email above first, then click Forgot password.");
      return;
    }
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch {
      setError("Could not send reset email. Check the address and try again.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">BillEx</CardTitle>
          <p className="text-sm text-gray-500">Government Pleader Billing</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {(error || sessionError) && (
              <p className="text-sm text-red-600">{error || sessionError}</p>
            )}
            {resetSent && (
              <p className="text-sm text-green-600">
                Password reset email sent, if that address has an account.
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </Button>

            <button
              type="button"
              onClick={handleForgotPassword}
              className="w-full text-center text-sm text-blue-600 hover:underline"
            >
              Forgot password?
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-gray-400">
            Accounts are created by an Admin. Contact your Admin for access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
