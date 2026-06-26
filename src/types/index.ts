import { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "user";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  clientName: string;
  status: "open" | "closed" | "pending";
  assignedTo: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Entry {
  id: string;
  caseId: string;
  caseNumber: string;
  date: string;
  description: string;
  hours: number;
  amount: number;
  enteredBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Document {
  id: string;
  caseId: string;
  caseNumber: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: Timestamp;
}
