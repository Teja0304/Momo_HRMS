import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { AttendancePolicy, AttendancePolicyProvider } from '../interfaces/attendance-policy-provider.interface';

/**
 * V1 implementation: a single policy, sourced from environment
 * configuration, applied to every office. The `officeId` parameter is
 * accepted (not ignored at the type level) so a future implementation
 * can look up a per-office policy from a database without changing
 * every call site.
 */
@Injectable()
export class ConfigAttendancePolicyProvider implements AttendancePolicyProvider {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async getPolicy(_officeId: string): Promise<AttendancePolicy> {
    return this.configService.get('policy', { infer: true });
  }
}
