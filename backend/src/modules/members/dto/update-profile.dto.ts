import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUrl, Matches, ValidateIf } from 'class-validator';

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
    description: 'Số điện thoại liên hệ (10 số Việt Nam)',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => !!o.phoneNumber)
  @Matches(/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/, {
    message: 'Số điện thoại không hợp lệ (cần đúng 10 số di động Việt Nam, ví dụ: 0903456789 hoặc +84903456789)',
  })
  phoneNumber?: string | null;

  @ApiPropertyOptional({
    example: 'https://lh3.googleusercontent.com/...',
    description: 'Đường dẫn ảnh đại diện',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string | null;

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
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => !!o.githubUrl)
  @IsUrl({}, { message: 'Link GitHub phải là đường dẫn URL hợp lệ (bắt đầu bằng http:// hoặc https://)' })
  githubUrl?: string | null;

  @ApiPropertyOptional({
    example: 'https://linkedin.com/in/username',
    description: 'Đường dẫn trang LinkedIn',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => !!o.linkedinUrl)
  @IsUrl({}, { message: 'Link LinkedIn phải là đường dẫn URL hợp lệ (bắt đầu bằng http:// hoặc https://)' })
  linkedinUrl?: string | null;

  @ApiPropertyOptional({
    example: 'https://facebook.com/username',
    description: 'Đường dẫn trang Facebook',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => !!o.facebookUrl)
  @IsUrl({}, { message: 'Link Facebook phải là đường dẫn URL hợp lệ (bắt đầu bằng http:// hoặc https://)' })
  facebookUrl?: string | null;
}
