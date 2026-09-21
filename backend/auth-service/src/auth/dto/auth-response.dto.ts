import { ApiProperty } from '@nestjs/swagger';

export class SafeUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ required: false, nullable: true })
  fullName: string | null;

  @ApiProperty({ type: [String] })
  roles: string[];

  @ApiProperty({ type: [String] })
  permissions: string[];

  @ApiProperty({ required: false })
  isActive?: boolean;

  @ApiProperty({ description: 'True if the frontend must force a password-change flow' })
  mustChangePassword: boolean;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ type: SafeUserDto })
  user: SafeUserDto;
}
