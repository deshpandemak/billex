import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { UserRole } from "@/types";

const VALID_ROLES: UserRole[] = ["admin", "data_operator", "bill_viewer"];

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!callerSnap.exists || callerSnap.data()?.role !== "admin") {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { uid: decoded.uid };
  } catch (err) {
    console.error("[admin/users] requireAdmin token verification failed", err);
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { email, displayName, password, role, pleaderId } = body as {
    email?: string;
    displayName?: string;
    password?: string;
    role?: UserRole;
    pleaderId?: string | null;
  };

  if (!email || !password || !role || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  if (role === "bill_viewer") {
    if (!pleaderId) {
      return NextResponse.json({ error: "A Pleader must be selected for Bill Viewer logins" }, { status: 400 });
    }
    const pleaderSnap = await adminDb.collection("pleaders").doc(pleaderId).get();
    if (!pleaderSnap.exists) {
      return NextResponse.json({ error: "Selected pleader does not exist" }, { status: 400 });
    }
  }

  try {
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: displayName || email,
    });

    await adminDb.collection("users").doc(userRecord.uid).set({
      email,
      displayName: displayName || email,
      role,
      active: true,
      pleaderId: role === "bill_viewer" ? pleaderId : null,
      createdAt: new Date(),
      createdBy: auth.uid,
      lastLoginAt: null,
    });

    return NextResponse.json({ uid: userRecord.uid });
  } catch (err) {
    console.error("[admin/users POST] createUser failed", err);
    const msg = err instanceof Error ? err.message : "Failed to create user";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { uid, role, active, displayName } = body as {
    uid?: string;
    role?: UserRole;
    active?: boolean;
    displayName?: string;
  };

  if (!uid) {
    return NextResponse.json({ error: "Missing uid" }, { status: 400 });
  }
  if (role && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (role === "bill_viewer") {
    // Bill Viewer logins must be created with a linked Pleader via POST —
    // there's no way to attach one through this endpoint, so switching an
    // existing login to this role here would leave it unlinked.
    return NextResponse.json(
      { error: "Bill Viewer logins must be created via the Create Login form, not by changing an existing login's role." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (role) updates.role = role;
  if (typeof active === "boolean") updates.active = active;
  if (displayName) updates.displayName = displayName;

  try {
    if (Object.keys(updates).length > 0) {
      await adminDb.collection("users").doc(uid).update(updates);
    }
    if (typeof active === "boolean") {
      await adminAuth.updateUser(uid, { disabled: !active });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/users PATCH] update failed", err);
    const msg = err instanceof Error ? err.message : "Failed to update user";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { uid } = body as { uid?: string };
  if (!uid) {
    return NextResponse.json({ error: "Missing uid" }, { status: 400 });
  }
  if (uid === auth.uid) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  try {
    await Promise.all([
      adminAuth.deleteUser(uid),
      adminDb.collection("users").doc(uid).delete(),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/users DELETE] delete failed", err);
    const msg = err instanceof Error ? err.message : "Failed to delete user";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
