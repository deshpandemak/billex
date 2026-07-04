# BillEx — Government Pleader Billing Spec

## Roles

| Role | Access |
|---|---|
| **Admin** | Manages Government Pleader roster & designations, Fee Configuration, and Logins & Roles (create/disable/delete logins, assign roles). Can view Billing. Does not use the Board Data entry screen. |
| **Data Operator** | Exclusive access to Board Data: upload a board PDF for a date, and add/edit/delete rows in the per-date case table. |
| **Bill Viewer** | Read-only access to the Billing screen (filter by date range / designation, export CSV). |

Logins are provisioned only by an Admin (`/admin/users`) — there is no self-service sign-up. New accounts sign in with email + the password an Admin set, and can reset it via "Forgot password."

## Pleader designations

Configured by Admin at `/admin/pleaders`, one designation per pleader:

- **GP** — Government Pleader
- **ADDL_GP** — Additional Government Pleader
- **AGP** — Assistant to Government Pleader
- **BPANEL** — B'Panel Advocate

## Fee schedule

Configured by Admin at `/admin/fees`: one fee amount (₹) per designation, per result type:

- Adjourned
- Heard & Adjourned
- Disposed

When a board row is assigned a pleader and a result status, its Fees column is looked up automatically from `feeConfig[designation][status]` — it is not manually editable.

## Board Data (`/board`, Data Operator only)

1. Pick a board date.
2. Optionally upload one or more board PDFs; `POST /api/board/parse` extracts text server-side (`pdf-parse`) and runs it through a Bombay High Court cause-list-aware parser (`src/lib/parser/board-parser.ts`) that recognizes the DAILY MAIN/SUPPLEMENTARY and WEEKLY MAIN header formats, case-number patterns (WP, PIL, CP, IA, …/no/year), and the GP/Addl GP/AGP advocate line. Each parsed row is pre-filled (Case Type / Case No. / Year / Party Name / Remarks) and best-effort matched against the active pleader roster by name; unmatched rows are left blank. This is still best-effort — the operator reviews and completes every row before saving, since board PDF layouts vary.
3. Table columns: Date (date picker, editable per row), Case Type, Case No., Year, Party Name (free text), Remarks (free text), Result/Status (dropdown: Adjourned / Heard & Adjourned / Disposed), Fees (₹, auto-computed), GP/Addl GP/AGP/B'Pnl (dropdown of active pleaders, showing name + designation).
4. Rows can be added, edited inline, or deleted; "Save" persists all rows for the visible date to Firestore (`boardEntries`).

## Billing (`/billing`, Bill Viewer + Admin)

Filters `boardEntries` by date range and optional designation, shows a totals row, and exports CSV.

## Data model (Firestore)

- `users/{uid}` — email, displayName, role, active, createdAt, createdBy, lastLoginAt
- `pleaders/{id}` — name, designation, active
- `feeConfig/{designation}` — adjourned, heardAdjourned, disposed
- `boardEntries/{id}` — date, caseType, caseNo, year, partyName, remarks, status, pleaderId, pleaderName, designation, fees

See `src/types/index.ts` for full field types and `firestore.rules` for the access matrix.
