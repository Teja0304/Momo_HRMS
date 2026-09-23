import { ApiProperty } from '@nestjs/swagger';
import {
  AttendanceStatus,
  CheckInStatus,
  CheckoutReason,
  CheckoutType,
} from '../enums';

export class AttendanceSessionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  officeId: string;

  @ApiProperty({ example: '2026-09-22' })
  attendanceDate: string;

  @ApiProperty({ enum: AttendanceStatus })
  status: AttendanceStatus;

  @ApiProperty()
  checkInAt: Date;

  @ApiProperty({ nullable: true })
  checkOutAt: Date | null;

  @ApiProperty({ enum: CheckInStatus })
  checkInStatus: CheckInStatus;

  @ApiProperty({ nullable: true })
  currentPauseStartedAt: Date | null;

  @ApiProperty({ nullable: true })
  currentGraceDeadline: Date | null;

  @ApiProperty({ enum: CheckoutType, nullable: true })
  checkoutType: CheckoutType | null;

  @ApiProperty({ enum: CheckoutReason, nullable: true })
  checkoutReason: CheckoutReason | null;

  @ApiProperty({ description: 'Live-computed, not just the stored column' })
  totalWorkingSeconds: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SyncEventResultDto {
  @ApiProperty()
  clientEventId: string;

  @ApiProperty({ example: 'PROCESSED' })
  status: string;

  @ApiProperty({ required: false })
  message?: string;
}

export class SyncResponseDto {
  @ApiProperty({ type: [SyncEventResultDto] })
  results: SyncEventResultDto[];
}

export class TodayAttendanceResponseDto {
  @ApiProperty({ example: '2026-09-22' })
  attendanceDate: string;

  @ApiProperty({ type: [AttendanceSessionResponseDto] })
  sessions: AttendanceSessionResponseDto[];

  @ApiProperty({ description: 'Sum of totalWorkingSeconds across all sessions today' })
  totalWorkingSecondsToday: number;

  @ApiProperty({ description: 'Whether the employee has an active (WORKING/PAUSED) session right now' })
  hasActiveSession: boolean;
}

export class PaginatedHistoryResponseDto {
  @ApiProperty({ type: [AttendanceSessionResponseDto] })
  items: AttendanceSessionResponseDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;
}
