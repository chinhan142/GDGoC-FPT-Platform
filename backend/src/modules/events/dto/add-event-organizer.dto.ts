import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class AddEventOrganizerDto {
  @ApiProperty({
    description: 'ID of the user being assigned as an organizer',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'ID of the professional department represented by the user',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  departmentId: string;

  @ApiProperty({
    description: 'The organizer role performed by the user at the event',
    example: 'Technical Lead',
  })
  @IsString()
  @IsNotEmpty()
  roleInEvent: string;
}
