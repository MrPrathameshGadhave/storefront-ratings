/**
 * Audit logging system for tracking administrative actions.
 * Provides a centralized way to log important user and business actions for compliance and debugging.
 */

import { logger } from "./logger.js";

export type AuditAction =
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DELETED"
  | "USER_ROLE_CHANGED"
  | "STORE_CREATED"
  | "STORE_UPDATED"
  | "STORE_DELETED"
  | "STORE_OWNER_ASSIGNED"
  | "RATING_CREATED"
  | "RATING_UPDATED"
  | "RATING_DELETED"
  | "ADMIN_LOGIN"
  | "ADMIN_LOGOUT"
  | "PASSWORD_CHANGED"
  | "EMAIL_VERIFIED"
  | "OTP_GENERATED"
  | "OTP_VERIFIED"
  | "OTP_RESENT"
  | "PRIVILEGED_INVITATION_CREATED"
  | "PRIVILEGED_INVITATION_REDEEMED";

export interface AuditLog {
  action: AuditAction;
  actorId?: string; // The user performing the action
  actorRole?: string; // The role of the actor
  resourceType: "USER" | "STORE" | "RATING" | "SESSION" | "INVITATION";
  resourceId?: string; // The ID of the resource being acted upon
  changes?: Record<string, unknown>; // What changed (for updates)
  status: "SUCCESS" | "FAILURE";
  reason?: string; // Why it succeeded or failed
  ipAddress?: string; // For security tracking
  userAgent?: string; // Browser/client info
}

/**
 * Logs an administrative or important action for audit trail.
 * Use this for actions that should be tracked for compliance, debugging, or security.
 *
 * @param log - The audit log entry
 *
 * @example
 * auditLog({
 *   action: 'USER_CREATED',
 *   actorId: 'admin-id',
 *   actorRole: 'ADMIN',
 *   resourceType: 'USER',
 *   resourceId: 'new-user-id',
 *   status: 'SUCCESS',
 *   changes: { email: 'newuser@example.com' }
 * });
 */
export function auditLog(log: AuditLog): void {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    ...log,
  };

  // Log with appropriate level based on action and status
  if (log.status === "FAILURE") {
    logger.warn("Audit event - action failed", auditEntry);
  } else {
    logger.info("Audit event", auditEntry);
  }
}

/**
 * Shorthand for logging a successful user creation
 */
export function auditUserCreated(
  actorId: string,
  userId: string,
  email: string,
  role: string,
): void {
  auditLog({
    action: "USER_CREATED",
    actorId,
    actorRole: "ADMIN",
    resourceType: "USER",
    resourceId: userId,
    changes: { email, role },
    status: "SUCCESS",
  });
}

/**
 * Shorthand for logging a user role change
 */
export function auditUserRoleChanged(
  actorId: string,
  userId: string,
  oldRole: string,
  newRole: string,
): void {
  auditLog({
    action: "USER_ROLE_CHANGED",
    actorId,
    actorRole: "ADMIN",
    resourceType: "USER",
    resourceId: userId,
    changes: { oldRole, newRole },
    status: "SUCCESS",
  });
}

/**
 * Shorthand for logging store creation
 */
export function auditStoreCreated(
  actorId: string,
  storeId: string,
  storeName: string,
  ownerId?: string,
): void {
  auditLog({
    action: "STORE_CREATED",
    actorId,
    actorRole: "ADMIN",
    resourceType: "STORE",
    resourceId: storeId,
    changes: { name: storeName, ownerId },
    status: "SUCCESS",
  });
}

/**
 * Shorthand for logging store owner assignment
 */
export function auditStoreOwnerAssigned(actorId: string, storeId: string, ownerId: string): void {
  auditLog({
    action: "STORE_OWNER_ASSIGNED",
    actorId,
    actorRole: "ADMIN",
    resourceType: "STORE",
    resourceId: storeId,
    changes: { ownerId },
    status: "SUCCESS",
  });
}

/**
 * Shorthand for logging admin login
 */
export function auditAdminLogin(userId: string, email: string, ipAddress?: string): void {
  auditLog({
    action: "ADMIN_LOGIN",
    actorId: userId,
    actorRole: "ADMIN",
    resourceType: "SESSION",
    resourceId: userId,
    status: "SUCCESS",
    ipAddress,
  });
}

/**
 * Shorthand for logging admin logout
 */
export function auditAdminLogout(userId: string, ipAddress?: string): void {
  auditLog({
    action: "ADMIN_LOGOUT",
    actorId: userId,
    actorRole: "ADMIN",
    resourceType: "SESSION",
    resourceId: userId,
    status: "SUCCESS",
    ipAddress,
  });
}

/**
 * Shorthand for logging email verification
 */
export function auditEmailVerified(userId: string, email: string): void {
  auditLog({
    action: "EMAIL_VERIFIED",
    resourceType: "USER",
    resourceId: userId,
    changes: { email, emailVerified: true },
    status: "SUCCESS",
  });
}

/**
 * Shorthand for logging password change
 */
export function auditPasswordChanged(userId: string, role: string): void {
  auditLog({
    action: "PASSWORD_CHANGED",
    actorId: userId,
    actorRole: role,
    resourceType: "USER",
    resourceId: userId,
    status: "SUCCESS",
  });
}

/**
 * Shorthand for logging failed authentication attempt
 */
export function auditFailedLogin(email: string, reason: string, ipAddress?: string): void {
  auditLog({
    action: "ADMIN_LOGIN",
    resourceType: "SESSION",
    status: "FAILURE",
    reason,
    ipAddress,
    changes: { attemptedEmail: email },
  });
}

/**
 * Shorthand for logging rating creation
 */
export function auditRatingCreated(userId: string, storeId: string, value: number): void {
  auditLog({
    action: "RATING_CREATED",
    actorId: userId,
    resourceType: "RATING",
    changes: { userId, storeId, value },
    status: "SUCCESS",
  });
}

/**
 * Shorthand for logging rating update
 */
export function auditRatingUpdated(
  userId: string,
  storeId: string,
  oldValue: number,
  newValue: number,
): void {
  auditLog({
    action: "RATING_UPDATED",
    actorId: userId,
    resourceType: "RATING",
    changes: { storeId, oldValue, newValue },
    status: "SUCCESS",
  });
}
