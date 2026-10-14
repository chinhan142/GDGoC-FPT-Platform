import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@fpt.edu.vn',
    description: 'Email đăng ký hoặc MSSV của thành viên',
  })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập Email hoặc MSSV' })
  email: string;
}
