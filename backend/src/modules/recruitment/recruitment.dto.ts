import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID, IsUrl, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export const DEPARTMENTS = ['AI', 'Cloud', 'Web Development', 'Research', 'Media', 'HR & Event'];
export const MAJORS = ['SE', 'IA', 'AI', 'GD', 'MC', 'IB', 'OTHER'];
export const SEMESTERS = ['FRESHMAN', 'SEM_1_3', 'SEM_4_6', 'SEM_7_PLUS'];
export const COMMITMENTS = ['5_8_HOURS', 'WILL_ARRANGE', 'LIMITED'];
const trim = Transform(({ value }) => typeof value === 'string' ? value.trim() : value);

export class RecruitmentDto {
  @IsUUID('4', { message: 'Mã yêu cầu không hợp lệ.' }) requestId: string;
  @trim @IsString({ message: 'Họ và tên không hợp lệ.' }) @MinLength(2, { message: 'Họ và tên cần có ít nhất 2 ký tự.' }) @MaxLength(120, { message: 'Họ và tên quá dài.' }) fullName: string;
  @trim @IsEmail({}, { message: 'Địa chỉ email không đúng định dạng.' }) @MaxLength(254, { message: 'Email quá dài.' }) email: string;
  @trim @Matches(/^(?:\+84|0)\d{9,10}$/, { message: 'Số điện thoại không hợp lệ (10 số, VD: 0901234567).' }) phone: string;
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @Matches(/^[A-Z]{2,4}\d{6,8}$/, { message: 'Mã số sinh viên không hợp lệ (VD: SE190000).' }) studentId: string;
  @IsIn(MAJORS, { message: 'Chuyên ngành học không hợp lệ.' }) major: string;
  @IsIn(SEMESTERS, { message: 'Kỳ học không hợp lệ.' }) semester: string;
  @trim @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Link Facebook phải bắt đầu bằng https://' }) @MaxLength(1000) facebookUrl: string;
  @IsIn(DEPARTMENTS, { message: 'Ban nguyện vọng 1 không hợp lệ.' }) nv1: string;
  @IsOptional() @ValidateIf((_, value) => value !== '') @IsIn(DEPARTMENTS, { message: 'Ban nguyện vọng 2 không hợp lệ.' }) nv2?: string;
  @trim @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Link Portfolio/CV phải bắt đầu bằng https://' }) @MaxLength(1000) portfolioUrl: string;
  @trim @IsOptional() @IsString() @MaxLength(3000) techStack?: string;
  @trim @IsOptional() @IsString() @MaxLength(3000) nonTechSkills?: string;
  @trim @IsOptional() @IsString() @MaxLength(3000) communitySkills?: string;
  @trim @IsString({ message: 'Dự án tâm đắc không hợp lệ.' }) @MinLength(10, { message: 'Dự án tâm đắc cần chia sẻ chi tiết hơn (tối thiểu 10 ký tự).' }) @MaxLength(5000) projectHighlight: string;
  @trim @IsString({ message: 'Mục tiêu gia nhập không hợp lệ.' }) @MinLength(10, { message: 'Mục tiêu gia nhập cần chia sẻ chi tiết hơn (tối thiểu 10 ký tự).' }) @MaxLength(5000) goals: string;
  // Optional for previously opened forms; new forms require this answer.
  @trim @IsOptional() @IsString({ message: 'Góc nhìn cảm hứng không hợp lệ.' }) @MinLength(10, { message: 'Câu trả lời cảm hứng/ấn tượng cần chi tiết hơn (tối thiểu 10 ký tự).' }) @MaxLength(5000) inspiration?: string;
  // Compatibility only: old open forms and persisted sync jobs may still carry it.
  // The current frontend does not collect or send a commitment answer.
  @IsOptional() @IsIn(COMMITMENTS) commitment?: string;
  @trim @IsOptional() @IsString() @MaxLength(3000) message?: string;
  @IsBoolean({ message: 'Vui lòng xác nhận đồng ý điều khoản.' }) consent: boolean;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}
