import { EventType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'Build with AI Workshop' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    example: 'A hands-on workshop about building applications with AI.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ enum: EventType, example: EventType.WORKSHOP })
  @IsEnum(EventType)
  type: EventType;

  @ApiProperty({ example: 'FPT University HCMC, Hall A' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ example: '2026-09-15T08:00:00.000Z', format: 'date-time' })
  @IsISO8601()
  startTime: string;

  @ApiProperty({ example: '2026-09-15T11:00:00.000Z', format: 'date-time' })
  @IsISO8601()
  endTime: string;

  @ApiPropertyOptional({ default: 20, minimum: 0, example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  attendeeGems?: number;

  @ApiPropertyOptional({ default: 100, minimum: 0, example: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  organizerGems?: number;

  @ApiPropertyOptional({
    example: 'https://drive.google.com/drive/folders/example',
    nullable: true,
  })
  @IsOptional()
  @IsUrl()
  driveFolderUrl?: string | null;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  tenureId: string;
}
