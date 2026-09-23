import { DepartmentType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class OnboardMemberDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^(SE|SS|IA|IB|GD|CS|IT|HE)\d{6}$/, {
    message: 'Student ID is not valid!',
  })
  mssv: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  phoneNumber: string;

  @IsNotEmpty()
  @IsEnum(DepartmentType)
  departmentCode: DepartmentType;
}
