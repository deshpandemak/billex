// One-off migration: convert existing boardEntries.date and bills.dateFrom/dateTo
// from "YYYY-MM-DD" to "DD-MM-YYYY", adding the sibling *ISO fields
// (dateISO / dateFromISO / dateToISO) the app now uses for Firestore range/order
// queries. Idempotent — documents already in DD-MM-YYYY are skipped, so it's
// safe to re-run.
//
// Usage:
//   node scripts/migrate-dates.mjs            # apply changes
//   node scripts/migrate-dates.mjs --dry-run   # report what would change, no writes
//
// Credentials: same as src/lib/firebase/admin.ts —
//   FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY, and
//   FIREBASE_ADMIN_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID) must be set
//   in the environment (e.g. loaded from .env.local before running).

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_DATE_RE = /^\d{2}-\d{2}-\d{4}$/;

function isoToDisplay(iso) {
  const m = iso.match(ISO_DATE_RE);
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  return `${dd}-${mm}-${yyyy}`;
}

function getAdminApp() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    const missing = [
      !projectId && "FIREBASE_ADMIN_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID)",
      !clientEmail && "FIREBASE_ADMIN_CLIENT_EMAIL",
      !privateKey && "FIREBASE_ADMIN_PRIVATE_KEY",
    ].filter(Boolean).join(", ");
    throw new Error(`Missing env vars: ${missing}. Export them (or source .env.local) before running.`);
  }

  let parsedKey = privateKey.trim();
  if (parsedKey.startsWith('"') && parsedKey.endsWith('"')) parsedKey = parsedKey.slice(1, -1);
  parsedKey = parsedKey.replace(/\\n/g, "\n");

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey: parsedKey }) });
}

async function migrateCollection(db, dryRun, collectionName, fieldMap) {
  const snap = await db.collection(collectionName).get();
  let changed = 0;
  let skipped = 0;
  const BATCH_SIZE = 400;
  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const update = {};
    let needsUpdate = false;

    for (const [displayField, isoField] of fieldMap) {
      const value = data[displayField];
      if (typeof value !== "string") continue;
      if (DISPLAY_DATE_RE.test(value) && data[isoField]) continue; // already migrated
      const display = isoToDisplay(value);
      if (!display) continue; // not YYYY-MM-DD either — leave untouched
      update[isoField] = value;
      update[displayField] = display;
      needsUpdate = true;
    }

    if (!needsUpdate) {
      skipped++;
      continue;
    }

    changed++;
    if (dryRun) {
      console.log(`[dry-run] ${collectionName}/${doc.id}:`, update);
      continue;
    }

    batch.update(doc.ref, update);
    opsInBatch++;
    if (opsInBatch >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (!dryRun && opsInBatch > 0) {
    await batch.commit();
  }

  console.log(`${collectionName}: ${changed} updated, ${skipped} already migrated/skipped (of ${snap.size} total)`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const app = getAdminApp();
  const db = getFirestore(app);

  console.log(dryRun ? "Running in DRY-RUN mode — no writes will be made.\n" : "Applying migration...\n");

  await migrateCollection(db, dryRun, "boardEntries", [["date", "dateISO"]]);
  await migrateCollection(db, dryRun, "bills", [
    ["dateFrom", "dateFromISO"],
    ["dateTo", "dateToISO"],
  ]);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
