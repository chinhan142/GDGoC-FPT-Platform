import { IsOptional, IsString, IsUUID } from 'class-validator';
export class AddContributorDto {
  @IsUUID() userId: string;
  @IsOptional() @IsString() roleInEvent?: string;
  @IsOptional() @IsString() notes?: string;
}
