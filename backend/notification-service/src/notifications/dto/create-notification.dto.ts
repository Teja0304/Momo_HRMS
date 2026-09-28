import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject, IsIn } from 'class-validator';

export const NOTIFICATION_TYPES = [
  'GEOFENCE_EXIT_WARNING',
  'GEOFENCE_RETURN',
  'CHECKIN_CONFIRMATION',
  'CHECKOUT_CONFIRMATION',
  'EXCEPTION_REQUESTED',
  'EXCEPTION_APPROVED',
  'EXCEPTION_REJECTED',
  'SYSTEM_ALERT',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export class CreateNotificationDto {
  @ApiProperty({ description: 'Target recipient (employee ID, user ID, or ALL)' })
  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @ApiPropertyOptional({ description: 'Recipient classification (EMPLOYEE, USER, BROADCAST)', default: 'EMPLOYEE' })
  @IsOptional()
  @IsIn(['EMPLOYEE', 'USER', 'BROADCAST'])
  recipientType?: string;

  @ApiProperty({ description: 'Notification type', enum: NOTIFICATION_TYPES })
  @IsString()
  @IsIn(NOTIFICATION_TYPES as unknown as string[])
  type: NotificationType;

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Notification body text' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({ description: 'Arbitrary contextual payload (e.g. officeId, session, distance)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
