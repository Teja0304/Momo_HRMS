import { Module } from '@nestjs/common';
import { GeofenceModule } from '../geofence/geofence.module';
import { EmployeeModule } from '../employee/employee.module';
import { PolicyModule } from '../policy/policy.module';
import { FaceModule } from '../face/face.module';
import { AttendanceController } from './controllers/attendance.controller';
import { ExceptionsController } from './controllers/exceptions.controller';
import { AttendanceService } from './services/attendance.service';
import { ExceptionsService } from './services/exceptions.service';
import { WorkingTimeService } from './services/working-time.service';
import { AutoCheckoutScheduler } from './jobs/auto-checkout.scheduler';

@Module({
  imports: [GeofenceModule, EmployeeModule, PolicyModule, FaceModule],
  controllers: [ExceptionsController, AttendanceController],
  providers: [AttendanceService, ExceptionsService, WorkingTimeService, AutoCheckoutScheduler],
  exports: [AttendanceService, ExceptionsService, WorkingTimeService],
})
export class AttendanceModule {}

