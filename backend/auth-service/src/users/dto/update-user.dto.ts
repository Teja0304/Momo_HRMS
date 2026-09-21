import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ required: false, example: 'Jane Smith' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @ApiProperty({ required: false, example: 'jane.smith@company.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    required: false,
    type: [String],
    example: ['HR_ADMIN'],
    description: 'Full replacement set of role names for this user',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roles?: string[];
}
