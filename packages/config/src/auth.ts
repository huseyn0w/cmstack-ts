import { z } from 'zod';

/**
 * Shared authentication & authorization contracts. The NestJS API is the source
 * of truth for identity; the Next.js web app (Auth.js) consumes these exact
 * shapes. Keep web and api in lockstep by importing from here only.
 */

// --- CASL primitives ---------------------------------------------------------

/** Actions a subject can be acted upon with. `manage` is the CASL wildcard. */
export const CASL_ACTIONS = ['manage', 'create', 'read', 'update', 'delete'] as const;
export const caslActionSchema = z.enum(CASL_ACTIONS);
export type CaslAction = z.infer<typeof caslActionSchema>;

/** A single granular permission: an (action, subject) pair. `all` = any subject. */
export const permissionSchema = z.object({
  action: caslActionSchema,
  subject: z.string().min(1),
});
export type Permission = z.infer<typeof permissionSchema>;

// --- Users -------------------------------------------------------------------

export const publicRoleSchema = z.object({
  name: z.string(),
  permissions: z.array(permissionSchema),
});
export type PublicRole = z.infer<typeof publicRoleSchema>;

/** The user shape safe to expose to clients (never includes the password hash). */
export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  role: publicRoleSchema.nullable(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

// --- Request / response payloads --------------------------------------------

// Email is lower-cased so addresses are treated case-insensitively and a user
// cannot accidentally (or maliciously) create a duplicate of an existing account.
export const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().min(1).max(120).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Server-to-server OAuth upsert. Called by the web server (Auth.js) after a
 * successful provider sign-in; protected by an internal shared secret so it can
 * trust the asserted email/identity.
 */
export const oauthSchema = z.object({
  provider: z.string().min(1),
  providerAccountId: z.string().min(1),
  email: z.string().email().toLowerCase(),
  name: z.string().trim().min(1).max(120).nullable().optional(),
  image: z.string().url().nullable().optional(),
});
export type OAuthInput = z.infer<typeof oauthSchema>;

export const authResultSchema = z.object({
  accessToken: z.string(),
  user: publicUserSchema,
});
export type AuthResult = z.infer<typeof authResultSchema>;
