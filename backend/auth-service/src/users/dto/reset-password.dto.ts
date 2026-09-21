import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/strong-password.validator';
// ...

export class ResetPasswordDto {
  @ApiProperty({ example: 'NewTemp1234!', minLength: 8 })
  @IsString()
  @IsStrongPassword()
  temporaryPassword: string;
}
