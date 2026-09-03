import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateEventFolderDto {
  @IsUUID()
  @IsNotEmpty()
  eventId: string;
}
