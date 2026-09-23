import { Module } from '@nestjs/common';
import { ATTENDANCE_POLICY_PROVIDER } from './interfaces/attendance-policy-provider.interface';
import { ConfigAttendancePolicyProvider } from './providers/config-attendance-policy.provider';

@Module({
  providers: [
    ConfigAttendancePolicyProvider,
    { provide: ATTENDANCE_POLICY_PROVIDER, useExisting: ConfigAttendancePolicyProvider },
  ],
  exports: [ATTENDANCE_POLICY_PROVIDER],
})
export class PolicyModule {}
