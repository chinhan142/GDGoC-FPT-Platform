import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'user@gmail.com',
    description: 'Member university email',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'Password123@',
    description: 'Account password',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1024)
  password: string;
}
