import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'user@gmail.com',
    description: 'Member university email',
  })
  @IsNotEmpty()
  @IsEmail()
  @IsString()
  email: string;

  @ApiProperty({
    example: 'Password123@',
    description: 'Account password',
  })
  @IsNotEmpty()
  @IsString()
  password: string;
}
