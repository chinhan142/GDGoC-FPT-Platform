import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateEventDto {
  @ApiProperty({
    example: 'Google Cloud Day',
    description: 'Event name',
  })
  @IsString()
  @IsNotEmpty()
  eventName: string;

  @ApiProperty({
    example: '2026-10-15',
    description: 'Date of event in format (YYYY-MM-DD)',
  })
  @IsString()
  @IsNotEmpty()
  eventDate: string;
}
