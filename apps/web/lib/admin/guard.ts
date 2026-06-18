import 'server-only';

import { auth } from '@/auth';
import type { Permission } from '@typress/config';
import type { Session } from 'next-auth';
import { redirect } from 'next/navigation';

/** Returns true if the permission set grants admin access. */
export function hasAdminAccess(permissions: Permission[]): boolean {
  return permissions.some(
    (p) =>
      (p.action === 'manage' && p.subject === 'all') ||
      (p.action === 'read' && p.subject === 'Admin'),
  );
}

/** Returns true if the session grants user management capability. */
export function canManageUsers(session: Session): boolean {
  const permissions = session.user.role?.permissions ?? [];
  return permissions.some(
    (p) =>
      (p.action === 'manage' && p.subject === 'all') ||
      (p.action === 'manage' && p.subject === 'User'),
  );
}

/** Returns true if the session grants site-settings (appearance) capability. */
export function canManageSettings(session: Session): boolean {
  const permissions = session.user.role?.permissions ?? [];
  return permissions.some(
    (p) =>
      (p.action === 'manage' && p.subject === 'all') ||
      (p.action === 'manage' && p.subject === 'Setting'),
  );
}

/** Returns true if the session grants SEO/GEO management capability. */
export function canManageSeo(session: Session): boolean {
  const permissions = session.user.role?.permissions ?? [];
  return permissions.some(
    (p) =>
      (p.action === 'manage' && p.subject === 'all') ||
      (p.action === 'manage' && p.subject === 'Seo'),
  );
}

/**
 * Server-only guard for /admin routes.
 * Redirects to /signin if unauthenticated, to / if not admin-capable.
 * Returns the session when authorized.
 */
export async function requireAdminSession(): Promise<Session> {
  const session = await auth();

  if (!session) {
    redirect('/signin?callbackUrl=/admin');
  }

  const permissions = session.user.role?.permissions ?? [];
  if (!hasAdminAccess(permissions)) {
    redirect('/');
  }

  return session;
}
