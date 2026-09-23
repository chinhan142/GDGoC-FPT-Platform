import { IsNotEmpty, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitTaskDto {
  @ApiProperty({
    description:
      'Link bài nộp (Google Drive / GitHub repository / Figma link...)',
    example: 'https://github.com/GDGoC-FPT/project-repo',
  })
  @IsUrl()
  @IsNotEmpty()
  submissionUrl: string;
}
