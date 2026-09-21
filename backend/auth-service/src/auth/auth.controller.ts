import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetInitialPasswordDto } from './dto/set-initial-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from '../common/decorators/public.decorator';
import { SkipPasswordChangeCheck } from '../common/decorators/skip-password-change-check.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { LoginThrottlerGuard } from './guards/login-throttler.guard';
import { UsersService } from '../users/users.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @UseGuards(LoginThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.authService.login(dto, this.extractMetadata(req));
  }

  @Public()
  @UseGuards(LoginThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.authService.refresh(dto.refreshToken, this.extractMetadata(req));
  }

  @ApiBearerAuth()
  @SkipPasswordChangeCheck()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto): Promise<{ success: true }> {
    await this.authService.logout(dto.refreshToken);
    return { success: true };
  }

  @ApiBearerAuth()
  @SkipPasswordChangeCheck()
  @HttpCode(HttpStatus.OK)
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<{ success: true }> {
    await this.authService.logoutAll(user.id);
    return { success: true };
  }

  @ApiBearerAuth()
  @SkipPasswordChangeCheck()
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.usersService.getUserOrThrow(user.id);
    return {
      id: profile.id,
      username: profile.username,
      fullName: profile.fullName,
      email: profile.email,
      roles: profile.roles,
      permissions: user.permissions,
      isActive: profile.isActive,
      mustChangePassword: profile.mustChangePassword,
    };
  }

  @ApiBearerAuth()
  @SkipPasswordChangeCheck()
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ success: true }> {
    await this.authService.changePassword(user.id, dto);
    return { success: true };
  }

  /**
   * Simplified first-login flow: no "current password" field required.
   * Only succeeds while the user still has mustChangePassword: true —
   * use POST /auth/change-password for a routine password change.
   */
  @ApiBearerAuth()
  @SkipPasswordChangeCheck()
  @HttpCode(HttpStatus.OK)
  @Post('set-initial-password')
  async setInitialPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetInitialPasswordDto,
  ): Promise<{ success: true }> {
    await this.authService.setInitialPassword(user.id, dto.newPassword);
    return { success: true };
  }

  private extractMetadata(req: Request) {
    return {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
