export type Role = "customer" | "pharmacist" | "operations" | "admin";
export const STAFF_ROLES = ["pharmacist", "operations", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
