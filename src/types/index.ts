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
