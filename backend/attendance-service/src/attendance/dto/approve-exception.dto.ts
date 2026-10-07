import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum ApproveStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class ApproveExceptionDto {
  @ApiProperty({ enum: ApproveStatus, example: ApproveStatus.APPROVED })
  @IsEnum(ApproveStatus)
  @IsNotEmpty()
  status!: ApproveStatus;

  @ApiProperty({ description: 'Optional HR comment or note', required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}
