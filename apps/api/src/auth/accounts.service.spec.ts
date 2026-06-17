import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaClient } from '@typress/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountsService } from './accounts.service';
import { PasswordService } from './password.service';

interface FakeRole {
  id: string;
  name: string;
  permissions: { action: string; subject: string }[];
}
interface FakeUser {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  image: string | null;
  roleId: string | null;
  role: FakeRole | null;
}

const memberRole: FakeRole = { id: 'role-member', name: 'Member', permissions: [] };

function makeFakePrisma(users: FakeUser[]) {
  let counter = users.length;
  return {
    user: {
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) =>
        users.find((u) => (where.email ? u.email === where.email : u.id === where.id)) ?? null,
      create: async ({ data }: { data: Partial<FakeUser> }) => {
        counter += 1;
        const role = data.roleId === memberRole.id ? memberRole : null;
        const user: FakeUser = {
          id: `u${counter}`,
          email: data.email ?? '',
          name: data.name ?? null,
          passwordHash: data.passwordHash ?? null,
          image: data.image ?? null,
          roleId: data.roleId ?? null,
          role,
        };
        users.push(user);
        return user;
      },
    },
    role: {
      findUnique: async ({ where }: { where: { name: string } }) =>
        where.name === memberRole.name ? memberRole : null,
    },
    account: {
      findUnique: async () => null,
      create: async () => ({}),
    },
  } as unknown as PrismaClient;
}

const fakeJwt = { signAsync: async () => 'fake.jwt.token' } as unknown as JwtService;
const passwords = new PasswordService();

describe('AccountsService', () => {
  let users: FakeUser[];

  beforeEach(() => {
    users = [];
  });

  it('register() creates a Member-role user and returns a token', async () => {
    const service = new AccountsService(makeFakePrisma(users), passwords, fakeJwt);
    const result = await service.register({ email: 'new@typress.local', password: 'password123' });

    expect(result.accessToken).toBe('fake.jwt.token');
    expect(result.user.email).toBe('new@typress.local');
    expect(result.user.role?.name).toBe('Member');
    expect(users[0]?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('register() rejects a duplicate email', async () => {
    users.push({
      id: 'u1',
      email: 'taken@typress.local',
      name: null,
      passwordHash: 'x',
      image: null,
      roleId: null,
      role: null,
    });
    const service = new AccountsService(makeFakePrisma(users), passwords, fakeJwt);
    await expect(
      service.register({ email: 'taken@typress.local', password: 'password123' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('login() succeeds with the correct password', async () => {
    const passwordHash = await passwords.hash('s3cret-password');
    users.push({
      id: 'u1',
      email: 'user@typress.local',
      name: 'User',
      passwordHash,
      image: null,
      roleId: memberRole.id,
      role: memberRole,
    });
    const service = new AccountsService(makeFakePrisma(users), passwords, fakeJwt);
    const result = await service.login({
      email: 'user@typress.local',
      password: 's3cret-password',
    });
    expect(result.accessToken).toBe('fake.jwt.token');
    expect(result.user.id).toBe('u1');
  });

  it('login() rejects a wrong password', async () => {
    const passwordHash = await passwords.hash('s3cret-password');
    users.push({
      id: 'u1',
      email: 'user@typress.local',
      name: 'User',
      passwordHash,
      image: null,
      roleId: memberRole.id,
      role: memberRole,
    });
    const service = new AccountsService(makeFakePrisma(users), passwords, fakeJwt);
    await expect(
      service.login({ email: 'user@typress.local', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login() rejects an unknown email', async () => {
    const service = new AccountsService(makeFakePrisma(users), passwords, fakeJwt);
    await expect(
      service.login({ email: 'ghost@typress.local', password: 'whatever' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
