import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let tokenService: TokenService;

  const configValues: Record<string, unknown> = {
    'jwt.accessSecret': 'test-access-secret',
    'jwt.refreshSecret': 'test-refresh-secret',
    'jwt.accessExpiration': '15m',
    'jwt.refreshExpiration': '7d',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TokenService,
        JwtService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => configValues[key],
          },
        },
      ],
    }).compile();

    tokenService = moduleRef.get(TokenService);
  });

  it('signs and can hash a refresh token deterministically', () => {
    const { token } = tokenService.signRefreshToken('user-123');
    const hashA = tokenService.hashToken(token);
    const hashB = tokenService.hashToken(token);
    expect(hashA).toEqual(hashB);
    expect(hashA).not.toEqual(token);
  });

  it('signs an access token containing sub and roles', () => {
    const token = tokenService.signAccessToken({ sub: 'user-123', roles: ['EMPLOYEE'] });
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('computes a refresh expiry roughly 7 days out', () => {
    const expiry = tokenService.getRefreshExpiryDate();
    const diffMs = expiry.getTime() - Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(diffMs).toBeGreaterThan(sevenDaysMs - 5000);
    expect(diffMs).toBeLessThan(sevenDaysMs + 5000);
  });
});
