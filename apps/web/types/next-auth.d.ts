import type { PublicRole } from '@typress/config';

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    user: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
      role: PublicRole | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    role: PublicRole | null;
    accessToken: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken: string;
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    role: PublicRole | null;
  }
}
