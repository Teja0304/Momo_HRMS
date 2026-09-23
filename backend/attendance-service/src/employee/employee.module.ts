import { Module } from '@nestjs/common';
import { EMPLOYEE_PROVIDER } from './interfaces/employee-provider.interface';
import { MockEmployeeProvider } from './providers/mock-employee.provider';

@Module({
  providers: [
    MockEmployeeProvider,
    { provide: EMPLOYEE_PROVIDER, useExisting: MockEmployeeProvider },
  ],
  exports: [EMPLOYEE_PROVIDER],
})
export class EmployeeModule {}
