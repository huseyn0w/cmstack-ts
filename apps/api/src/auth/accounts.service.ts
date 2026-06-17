import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthResult,
  CaslAction,
  LoginInput,
  OAuthInput,
  Permission,
  PublicUser,
  RegisterInput,
} from '@typress/config';
import { Prisma, type PrismaClient } from '@typress/db';
import { PRISMA } from '../prisma/prisma.module';
import type { AuthenticatedUser } from './authenticated-user';
import { PasswordService } from './password.service';

const userInclude = {
  role: { include: { permissions: true } },
} satisfies Prisma.UserInclude;

type UserWithRole = Prisma.UserGetPayload<{ include: typeof userInclude }>;

/** Default role assigned to self-registered and first-time OAuth users. */
const DEFAULT_ROLE = 'Member';

@Injectable()
export class AccountsService {
  /**
   * A throwaway hash, computed once, used to verify against on the
   * unknown-email / passwordless paths so login takes roughly constant time and
   * does not leak which emails are registered.
   */
  private readonly decoyHash: Promise<string>;

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {
    this.decoyHash = this.passwords.hash('typress-decoy-password');
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await this.passwords.hash(input.password);
    const role = await this.prisma.role.findUnique({ where: { name: DEFAULT_ROLE } });

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name ?? null,
        passwordHash,
        roleId: role?.id ?? null,
      },
      include: userInclude,
    });

    return this.buildAuthResult(user);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: userInclude,
    });

    // Always run a verification (against a decoy hash when the user or password
    // is absent) so response timing does not reveal which emails are registered.
    const hashToCheck = user?.passwordHash ?? (await this.decoyHash);
    const passwordMatches = await this.passwords.verify(hashToCheck, input.password);
    if (!user || user.passwordHash == null || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.buildAuthResult(user);
  }

  async oauth(input: OAuthInput): Promise<AuthResult> {
    const linked = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: input.provider,
          providerAccountId: input.providerAccountId,
        },
      },
      include: { user: { include: userInclude } },
    });
    if (linked) {
      return this.buildAuthResult(linked.user);
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: userInclude,
    });
    if (existing) {
      await this.prisma.account.create({
        data: {
          userId: existing.id,
          provider: input.provider,
          providerAccountId: input.providerAccountId,
        },
      });
      return this.buildAuthResult(existing);
    }

    const role = await this.prisma.role.findUnique({ where: { name: DEFAULT_ROLE } });
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name ?? null,
        image: input.image ?? null,
        emailVerified: new Date(),
        roleId: role?.id ?? null,
        accounts: {
          create: { provider: input.provider, providerAccountId: input.providerAccountId },
        },
      },
      include: userInclude,
    });
    return this.buildAuthResult(user);
  }

  /** Loads the user for an authenticated request, or null if they no longer exist. */
  async getAuthenticatedUserById(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!user) {
      return null;
    }
    return { ...this.toPublicUser(user), permissions: this.flattenPermissions(user) };
  }

  private async buildAuthResult(user: UserWithRole): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return { accessToken, user: this.toPublicUser(user) };
  }

  private toPublicUser(user: UserWithRole): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role ? { name: user.role.name, permissions: this.flattenPermissions(user) } : null,
    };
  }

  private flattenPermissions(user: UserWithRole): Permission[] {
    return (user.role?.permissions ?? []).map((p) => ({
      action: p.action as CaslAction,
      subject: p.subject,
    }));
  }
}
