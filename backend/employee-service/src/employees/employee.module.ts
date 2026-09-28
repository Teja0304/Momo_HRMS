import { Module } from '@nestjs/common';
import { EmployeeController } from './controllers/employee.controller';
import { OrganizationController } from './controllers/organization.controller';
import { EmployeeService } from './services/employee.service';
import { OrganizationService } from './services/organization.service';

@Module({
  controllers: [EmployeeController, OrganizationController],
  providers: [EmployeeService, OrganizationService],
  exports: [EmployeeService, OrganizationService],
})
export class EmployeeModule {}
