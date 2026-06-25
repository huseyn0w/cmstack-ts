import type {
  AccountRepository,
  RoleRepository,
  UserRepository,
  UserWithRole,
} from '@cmstack-ts/db';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountsService } from './accounts.service';
import { PasswordService } from './password.service';

const MEMBER_ROLE_ID = 'role-member';

function userRow(over: Partial<UserWithRole> = {}): UserWithRole {
  return {
    id: 'u1',
    email: 'user@cmstack-ts.local',
    name: 'User',
    passwordHash: null,
    image: null,
    bio: null,
    emailVerified: null,
    roleId: MEMBER_ROLE_ID,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    role: {
      id: MEMBER_ROLE_ID,
      name: 'Member',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: [],
    },
    ...over,
  } as UserWithRole;
}

const fakeJwt = { signAsync: async () => 'fake.jwt.token' } as unknown as JwtService;
const passwords = new PasswordService();

let users: Record<keyof UserRepository, ReturnType<typeof vi.fn>>;
let accounts: Record<keyof AccountRepository, ReturnType<typeof vi.fn>>;
let roles: Record<keyof RoleRepository, ReturnType<typeof vi.fn>>;
let service: AccountsService;

beforeEach(() => {
  users = {
    findByEmailWithRole: vi.fn().mockResolvedValue(null),
    findByIdWithRole: vi.fn(),
    findIdByEmail: vi.fn().mockResolvedValue(null),
    createWithRole: vi.fn(),
    createWithRoleAndAccount: vi.fn(),
    updateProfileFields: vi.fn(),
    updatePasswordHash: vi.fn(),
    listAndCount: vi.fn(),
    findByIdSummary: vi.fn(),
    updateAdmin: vi.fn(),
    findPublicProfile: vi.fn(),
    count: vi.fn(),
    exists: vi.fn(),
    hardDelete: vi.fn(),
  };
  accounts = { findByProvider: vi.fn().mockResolvedValue(null), linkToUser: vi.fn() };
  roles = {
    findIdByName: vi.fn().mockResolvedValue({ id: MEMBER_ROLE_ID }),
    findIdById: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
  };
  service = new AccountsService(
    users as unknown as UserRepository,
    accounts as unknown as AccountRepository,
    roles as unknown as RoleRepository,
    passwords,
    fakeJwt,
  );
});

describe('AccountsService.register', () => {
  it('creates a Member-role user (real Argon2id hash) and returns a token', async () => {
    users.createWithRole.mockImplementation(async (data) =>
      userRow({ email: data.email, passwordHash: data.passwordHash, roleId: data.roleId }),
    );
    const result = await service.register({
      email: 'new@cmstack-ts.local',
      password: 'password123',
    });

    expect(result.accessToken).toBe('fake.jwt.token');
    expect(result.user.email).toBe('new@cmstack-ts.local');
    expect(result.user.role?.name).toBe('Member');
    // the hash handed to the repo is a real argon2id hash, never the plaintext
    const passedHash = users.createWithRole.mock.calls[0]?.[0]?.passwordHash as string;
    expect(passedHash).toMatch(/^\$argon2id\$/);
    expect(passedHash).not.toContain('password123');
  });

  it('rejects a duplicate email before hashing or creating', async () => {
    users.findIdByEmail.mockResolvedValue({ id: 'u1' });
    await expect(
      service.register({ email: 'taken@cmstack-ts.local', password: 'password123' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(users.createWithRole).not.toHaveBeenCalled();
  });
});

describe('AccountsService.login', () => {
  it('succeeds with the correct password', async () => {
    const passwordHash = await passwords.hash('s3cret-password');
    users.findByEmailWithRole.mockResolvedValue(userRow({ id: 'u1', passwordHash }));
    const result = await service.login({
      email: 'user@cmstack-ts.local',
      password: 's3cret-password',
    });
    expect(result.accessToken).toBe('fake.jwt.token');
    expect(result.user.id).toBe('u1');
  });

  it('rejects a wrong password', async () => {
    const passwordHash = await passwords.hash('s3cret-password');
    users.findByEmailWithRole.mockResolvedValue(userRow({ id: 'u1', passwordHash }));
    await expect(
      service.login({ email: 'user@cmstack-ts.local', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown email (still runs a decoy verify)', async () => {
    users.findByEmailWithRole.mockResolvedValue(null);
    await expect(
      service.login({ email: 'ghost@cmstack-ts.local', password: 'whatever' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AccountsService.oauth', () => {
  it('returns the pre-loaded user when the account is already linked (no extra read)', async () => {
    const linkedUser = userRow({ id: 'u9' });
    accounts.findByProvider.mockResolvedValue({ user: linkedUser });
    const result = await service.oauth({
      provider: 'github',
      providerAccountId: 'gh1',
      email: 'x@y.com',
    });
    expect(result.user.id).toBe('u9');
    expect(users.findByEmailWithRole).not.toHaveBeenCalled();
    expect(users.createWithRoleAndAccount).not.toHaveBeenCalled();
  });

  it('links a new provider to an existing email without re-reading the user', async () => {
    accounts.findByProvider.mockResolvedValue(null);
    users.findByEmailWithRole.mockResolvedValue(userRow({ id: 'u1' }));
    await service.oauth({
      provider: 'github',
      providerAccountId: 'gh2',
      email: 'user@cmstack-ts.local',
    });
    expect(accounts.linkToUser).toHaveBeenCalledWith('u1', {
      provider: 'github',
      providerAccountId: 'gh2',
    });
    expect(users.createWithRoleAndAccount).not.toHaveBeenCalled();
  });

  it('creates a verified user + linked account for a brand-new OAuth identity', async () => {
    accounts.findByProvider.mockResolvedValue(null);
    users.findByEmailWithRole.mockResolvedValue(null);
    users.createWithRoleAndAccount.mockResolvedValue(userRow({ id: 'u2' }));
    await service.oauth({ provider: 'google', providerAccountId: 'g1', email: 'fresh@x.com' });
    expect(users.createWithRoleAndAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'fresh@x.com',
        roleId: MEMBER_ROLE_ID,
        provider: 'google',
        providerAccountId: 'g1',
      }),
    );
  });
});
