import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/strong-password.validator';
export class SetInitialPasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @IsStrongPassword()
  newPassword: string;
}
