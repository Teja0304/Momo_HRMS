import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@company.com or admin', description: 'Username or official email address' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Admin123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

