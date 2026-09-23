import { Module } from '@nestjs/common';
import { GeofenceModule } from '../geofence/geofence.module';
import { EmployeeModule } from '../employee/employee.module';
import { PolicyModule } from '../policy/policy.module';
import { AttendanceController } from './controllers/attendance.controller';
import { AttendanceService } from './services/attendance.service';
import { WorkingTimeService } from './services/working-time.service';
import { AutoCheckoutScheduler } from './jobs/auto-checkout.scheduler';

@Module({
  imports: [GeofenceModule, EmployeeModule, PolicyModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, WorkingTimeService, AutoCheckoutScheduler],
  exports: [AttendanceService, WorkingTimeService],
})
export class AttendanceModule {}
