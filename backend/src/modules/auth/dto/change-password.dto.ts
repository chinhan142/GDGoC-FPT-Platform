import { IsNotEmpty, IsString, IsStrongPassword, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @IsString()
  @IsNotEmpty()
  @IsStrongPassword()
  @MaxLength(72)
  newPassword: string;
}
