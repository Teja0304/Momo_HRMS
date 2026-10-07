import { Module } from '@nestjs/common';
import { EMPLOYEE_PROVIDER } from './interfaces/employee-provider.interface';
import { MockEmployeeProvider } from './providers/mock-employee.provider';
import { HttpEmployeeProvider } from './providers/http-employee.provider';

@Module({
  providers: [
    MockEmployeeProvider,
    HttpEmployeeProvider,
    { provide: EMPLOYEE_PROVIDER, useExisting: HttpEmployeeProvider },
  ],
  exports: [EMPLOYEE_PROVIDER, MockEmployeeProvider, HttpEmployeeProvider],
})
export class EmployeeModule {}

