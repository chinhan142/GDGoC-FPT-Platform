import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'Passionate Web & AI Developer at GDGoC FPTU.',
    description: 'Giới thiệu ngắn về bản thân',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    example: '0903456789',
    description: 'Số điện thoại liên hệ',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'https://lh3.googleusercontent.com/...',
    description: 'Đường dẫn ảnh đại diện',
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({
    example: ['NestJS', 'React', 'Gemini API', 'Docker'],
    description: 'Danh sách kỹ năng / công nghệ',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({
    example: 'https://github.com/username',
    description: 'Đường dẫn trang cá nhân GitHub',
  })
  @IsOptional()
  @IsUrl()
  githubUrl?: string;

  @ApiPropertyOptional({
    example: 'https://linkedin.com/in/username',
    description: 'Đường dẫn trang LinkedIn',
  })
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @ApiPropertyOptional({
    example: 'https://facebook.com/username',
    description: 'Đường dẫn trang Facebook',
  })
  @IsOptional()
  @IsUrl()
  facebookUrl?: string;

  @ApiPropertyOptional({
    example: 'chinhan#1234',
    description: 'Tên người dùng Discord',
  })
  @IsOptional()
  @IsString()
  discordUsername?: string;
}
