import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsStrongPassword, Matches, MaxLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'd9b7f3a8c1...',
    description: 'Reset token nhận được từ liên kết email',
  })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  @IsNotEmpty({ message: 'Token đặt lại mật khẩu là bắt buộc' })
  token: string;

  @ApiProperty({
    example: 'GDGoC@2026Password!',
    description: 'Mật khẩu mới (tối thiểu 8 ký tự, gồm chữ hoa, thường, số, ký tự đặc biệt)',
  })
  @IsString()
  @MaxLength(72)
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'Mật khẩu mới phải có tối thiểu 8 ký tự, gồm ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt.',
    },
  )
  newPassword: string;
}
