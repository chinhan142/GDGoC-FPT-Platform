import { IsIn } from 'class-validator';
export class TransitionTenureDto {
  @IsIn(['semester', 'tenure']) kind: 'semester' | 'tenure';
}
