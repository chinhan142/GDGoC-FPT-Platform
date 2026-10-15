import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID, IsUrl, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export const DEPARTMENTS = ['AI', 'Cloud', 'Web Development', 'Research', 'Media', 'HR & Event'];
export const MAJORS = ['SE', 'IA', 'AI', 'GD', 'MC', 'IB', 'OTHER'];
export const SEMESTERS = ['FRESHMAN', 'SEM_1_3', 'SEM_4_6', 'SEM_7_PLUS'];
export const COMMITMENTS = ['5_8_HOURS', 'WILL_ARRANGE', 'LIMITED'];
const trim = Transform(({ value }) => typeof value === 'string' ? value.trim() : value);

export class RecruitmentDto {
  @IsUUID('4') requestId: string;
  @trim @IsString() @MinLength(2) @MaxLength(120) fullName: string;
  @trim @IsEmail() @MaxLength(254) email: string;
  @trim @Matches(/^(?:\+84|0)\d{9,10}$/) phone: string;
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @Matches(/^[A-Z]{2,4}\d{6,8}$/) studentId: string;
  @IsIn(MAJORS) major: string;
  @IsIn(SEMESTERS) semester: string;
  @trim @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(1000) facebookUrl: string;
  @IsIn(DEPARTMENTS) nv1: string;
  @IsOptional() @ValidateIf((_, value) => value !== '') @IsIn(DEPARTMENTS) nv2?: string;
  @trim @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(1000) portfolioUrl: string;
  @trim @IsOptional() @IsString() @MaxLength(3000) techStack?: string;
  @trim @IsOptional() @IsString() @MaxLength(3000) nonTechSkills?: string;
  @trim @IsString() @MinLength(10) @MaxLength(5000) projectHighlight: string;
  @trim @IsString() @MinLength(10) @MaxLength(5000) goals: string;
  // Compatibility only: old open forms and persisted sync jobs may still carry it.
  // The current frontend does not collect or send a commitment answer.
  @IsOptional() @IsIn(COMMITMENTS) commitment?: string;
  @trim @IsOptional() @IsString() @MaxLength(3000) message?: string;
  @IsBoolean() consent: boolean;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}
