import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AddContributorsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ArrayUnique()
  @IsUUID('all', { each: true }) userIds: string[];
  @IsOptional() @IsString() @MaxLength(200) roleInEvent?: string;
}
