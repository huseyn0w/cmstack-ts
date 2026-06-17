import { type MongoAbility, createMongoAbility } from '@casl/ability';
import type { Permission } from '@typress/config';

/**
 * The application's CASL ability: a set of (action, subject) rules. We use string
 * actions/subjects so permissions stored in the database map 1:1 to CASL rules.
 * The CASL keywords `manage` (any action) and `all` (any subject) are honoured.
 */
export type AppAbility = MongoAbility<[string, string]>;

/** Build an ability from a user's granted permissions. */
export function buildAbility(permissions: Permission[]): AppAbility {
  return createMongoAbility<AppAbility>(
    permissions.map((p) => ({ action: p.action, subject: p.subject })),
  );
}
