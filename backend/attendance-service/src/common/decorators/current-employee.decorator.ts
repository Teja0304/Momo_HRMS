import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { EmployeeAuthContext } from '../interfaces/employee-auth-context.interface';

export const CurrentEmployee = createParamDecorator(
  (data: keyof EmployeeAuthContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const employee: EmployeeAuthContext = request.employeeAuth;
    return data ? employee?.[data] : employee;
  },
);
