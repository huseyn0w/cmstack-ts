import type { Permission, PublicUser } from '@typress/config';

/**
 * The shape attached to `request.user` by JwtAuthGuard. `permissions` is the
 * user's role permissions flattened for convenient CASL ability construction.
 */
export interface AuthenticatedUser extends PublicUser {
  permissions: Permission[];
}
