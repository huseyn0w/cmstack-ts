import { authResultSchema } from '@typress/config';
import type { PublicRole } from '@typress/config';
import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import type { Provider } from 'next-auth/providers';
import CredentialsProvider from 'next-auth/providers/credentials';
import GitHubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import { apiBaseUrl } from './app/lib/api';

const providers: Provider[] = [
  CredentialsProvider({
    id: 'credentials',
    name: 'Email & Password',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const email = credentials?.email;
      const password = credentials?.password;

      if (typeof email !== 'string' || typeof password !== 'string') {
        return null;
      }

      try {
        const res = await fetch(`${apiBaseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) return null;

        const parsed = authResultSchema.safeParse(await res.json());
        if (!parsed.success) return null;

        const { accessToken, user } = parsed.data;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          accessToken,
        };
      } catch {
        return null;
      }
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: { signIn: '/signin' },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Credentials: authorize() already validated against the API.
      if (!account || account.provider === 'credentials') return true;

      // OAuth providers: call the server-to-server OAuth upsert endpoint.
      const email = profile?.email ?? user.email;
      if (!email) return false;

      // KNOWN LIMITATION (tracked): the API links an OAuth identity to an
      // existing account by matching email. Google guarantees the email is
      // verified; GitHub's default profile does not expose verification status,
      // so before enabling GitHub in production, fetch the provider's verified
      // emails and reject unverified ones to prevent account takeover.

      const internalSecret = process.env.INTERNAL_API_SECRET;
      if (!internalSecret) return false;

      try {
        const res = await fetch(`${apiBaseUrl}/auth/oauth`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-internal-secret': internalSecret,
          },
          body: JSON.stringify({
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            email,
            name: profile?.name ?? user.name ?? null,
            image:
              profile?.picture ??
              (typeof profile?.image === 'string' ? profile.image : null) ??
              user.image ??
              null,
          }),
        });

        if (!res.ok) return false;

        const parsed = authResultSchema.safeParse(await res.json());
        if (!parsed.success) return false;

        const { accessToken, user: apiUser } = parsed.data;

        // Stash data on `user` so the jwt callback can pick it up on first sign-in.
        user.id = apiUser.id;
        user.email = apiUser.email;
        user.name = apiUser.name;
        user.image = apiUser.image;
        (user as { role?: PublicRole | null }).role = apiUser.role;
        (user as { accessToken?: string }).accessToken = accessToken;

        return true;
      } catch {
        return false;
      }
    },

    async jwt({ token, user }) {
      // `user` is only present on the initial sign-in call.
      if (user) {
        token.id = user.id ?? token.sub ?? '';
        token.email = user.email ?? '';
        token.name = user.name ?? null;
        token.image = user.image ?? null;
        token.role = (user as { role?: PublicRole | null }).role ?? null;
        token.accessToken = (user as { accessToken?: string }).accessToken ?? '';
      }
      return token;
    },

    async session({ session, token }) {
      // Cast to the augmented JWT type to get proper narrowed types.
      const t = token as JWT;
      return {
        ...session,
        accessToken: typeof t.accessToken === 'string' ? t.accessToken : '',
        user: {
          ...session.user,
          id: typeof t.id === 'string' ? t.id : (t.sub ?? ''),
          email: typeof t.email === 'string' ? t.email : '',
          name: typeof t.name === 'string' ? t.name : null,
          image: typeof t.image === 'string' ? t.image : null,
          role: (t.role as PublicRole | null | undefined) ?? null,
        },
      };
    },
  },
});
