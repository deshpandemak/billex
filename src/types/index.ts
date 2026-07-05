import { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "data_operator" | "bill_viewer";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  data_operator: "Data Operator",
  bill_viewer: "Bill Viewer",
};

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  pleaderId: string | null; // bill_viewer linked to this Pleader's bills
  createdAt: Timestamp;
  createdBy: string;
  lastLoginAt: Timestamp;
}

export type Designation = "GP" | "ADDL_GP" | "AGP" | "BPANEL";

export const DESIGNATION_LABELS: Record<Designation, string> = {
  GP: "Government Pleader",
  ADDL_GP: "Additional Government Pleader",
  AGP: "Assistant to Government Pleader",
  BPANEL: "B'Panel Advocate",
};

export const DESIGNATIONS: Designation[] = ["GP", "ADDL_GP", "AGP", "BPANEL"];

export interface Pleader {
  id: string;
  name: string;
  designation: Designation;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export type ResultStatus = "ADJOURNED" | "HEARD_ADJOURNED" | "DISPOSED";

export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  ADJOURNED: "Adjourned",
  HEARD_ADJOURNED: "Heard & Adjourned",
  DISPOSED: "Disposed",
};

export const RESULT_STATUSES: ResultStatus[] = ["ADJOURNED", "HEARD_ADJOURNED", "DISPOSED"];

export interface FeeConfig {
  designation: Designation;
  adjourned: number;
  heardAdjourned: number;
  disposed: number;
  updatedAt: Timestamp;
  updatedBy: string;
}

export type BillStatus = "open_for_review" | "under_revision" | "final";

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  open_for_review: "Open for Review",
  under_revision: "Under Revision",
  final: "Final",
};

export const BILL_STATUSES: BillStatus[] = ["open_for_review", "under_revision", "final"];

export interface Bill {
  id: string;
  dateFrom: string;           // YYYY-MM-DD
  dateTo: string;             // YYYY-MM-DD
  pleaderId: string;
  pleaderName: string;
  designation: Designation;
  status: BillStatus;
  totalFees: number;
  entryCount: number;
  createdAt: Timestamp;
  createdBy: string;          // uid
  createdByName: string;
  submittedAt: Timestamp | null;
  reviewerRemarks: string;
  reviewerRemarksBy: string;  // bill viewer display name
  reviewerRemarksAt: Timestamp | null;
  finalizedAt: Timestamp | null;
  finalizedBy: string | null; // uid
  finalizedByName: string | null;
}

export type AuditAction =
  | "board_entry_created"
  | "board_entry_updated"
  | "board_entry_deleted"
  | "bill_generated"
  | "bill_submitted"
  | "bill_remarks_added"
  | "bill_finalized";

export interface AuditLog {
  id: string;
  action: AuditAction;
  entityType: "boardEntry" | "bill";
  entityId: string;
  description: string;
  performedBy: string;        // uid
  performedByName: string;
  performedByRole: UserRole;
  timestamp: Timestamp;
  metadata: Record<string, string | number | boolean | null>;
}

export interface BoardEntry {
  id: string;
  date: string; // YYYY-MM-DD
  caseType: string;
  caseNo: string;
  year: string;
  partyName: string;
  remarks: string;
  status: ResultStatus;
  pleaderId: string;
  pleaderName: string;
  designation: Designation | "";
  fees: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
