import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/strong-password.validator';

export class CreateUserDto {
  @ApiProperty({ example: 'employee001' })
  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username may only contain letters, numbers, dots, underscores and hyphens',
  })
  username: string;

  @ApiProperty({ example: 'employee@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jane Smith', required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @ApiProperty({ example: 'Temp1234!', minLength: 8 })
  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiProperty({ example: ['EMPLOYEE'], type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roles: string[];
}
