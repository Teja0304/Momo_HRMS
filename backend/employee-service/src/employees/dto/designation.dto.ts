import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDesignationDto {
  @ApiProperty({ example: 'FIN_ANALYST', description: 'Unique designation code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;

  @ApiProperty({ example: 'Financial Analyst' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  title!: string;

  @ApiPropertyOptional({ description: 'Parent Department UUID' })
  @IsOptional()
  @IsString()
  departmentId?: string;
}
