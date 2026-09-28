import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ROLE_NAMES } from '../common/constants/rbac.constants';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserResponseDto } from './dto/user-response.dto';

// JwtAuthGuard + RolesGuard are registered globally (see AppModule),
// so this controller only needs @Roles() to declare its requirements.
@ApiTags('users')
@ApiBearerAuth()
@Controller('auth/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * User provisioning (NOT self-registration). SUPER_ADMIN and HR_ADMIN may
   * create users through this endpoint. HR_ADMIN cannot assign SUPER_ADMIN role.
   */
  @Post()
  @Roles(ROLE_NAMES.SUPER_ADMIN, ROLE_NAMES.HR_ADMIN)
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.createUser(dto, actor);
  }

  @Get()
  @Roles(ROLE_NAMES.SUPER_ADMIN, ROLE_NAMES.HR_ADMIN)
  findAll(): Promise<UserResponseDto[]> {
    return this.usersService.listUsers();
  }

  @Get(':id')
  @Roles(ROLE_NAMES.SUPER_ADMIN, ROLE_NAMES.HR_ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.getUserOrThrow(id);
  }

  @Patch(':id/status')
  @Roles(ROLE_NAMES.SUPER_ADMIN)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserResponseDto> {
    return this.usersService.setActiveStatus(id, dto.isActive);
  }

  @Patch(':id')
  @Roles(ROLE_NAMES.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateUser(id, dto);
  }

  /**
   * Admin-initiated password reset. Sets a temporary password chosen by
   * the admin, forces the user through the first-login reset flow again
   * (mustChangePassword -> true), and revokes all of their active
   * sessions.
   */
  @Post(':id/reset-password')
  @Roles(ROLE_NAMES.SUPER_ADMIN, ROLE_NAMES.HR_ADMIN)
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ success: true }> {
    await this.usersService.adminResetPassword(id, dto.temporaryPassword, actor);
    return { success: true };
  }

  @Delete(':id')
  @Roles(ROLE_NAMES.SUPER_ADMIN, ROLE_NAMES.HR_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.usersService.deleteUser(id);
  }
}
