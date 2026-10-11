import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitTaskDto {
  @ApiProperty({
    description:
      'Link bài nộp (Google Drive / GitHub repository / Figma link...) hoặc mô tả minh chứng',
    example: 'https://github.com/GDGoC-FPT/project-repo',
  })
  @IsString()
  @IsNotEmpty()
  submissionUrl: string;
}
