import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';

function buildContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ roles: [] }))).toBe(true);
  });

  it('denies access when the user lacks the required role', () => {
    const reflector = { getAllAndOverride: () => ['SUPER_ADMIN'] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(buildContext({ roles: ['EMPLOYEE'] }))).toThrow();
  });

  it('allows access when the user has one of the required roles', () => {
    const reflector = {
      getAllAndOverride: () => ['HR_ADMIN', 'SUPER_ADMIN'],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ roles: ['HR_ADMIN'] }))).toBe(true);
  });
});

describe('PermissionsGuard', () => {
  it('denies access when a required permission is missing', () => {
    const reflector = {
      getAllAndOverride: () => ['employee.create'],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() =>
      guard.canActivate(buildContext({ permissions: ['employee.view'] })),
    ).toThrow();
  });

  it('allows access when all required permissions are present', () => {
    const reflector = {
      getAllAndOverride: () => ['employee.view', 'employee.create'],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(
      guard.canActivate(buildContext({ permissions: ['employee.view', 'employee.create'] })),
    ).toBe(true);
  });
});
