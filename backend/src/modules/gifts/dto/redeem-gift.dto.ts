import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RedeemGiftDto {
  @ApiProperty({ description: 'ID của món quà tặng cần đổi' })
  @IsString()
  @IsNotEmpty()
  giftItemId: string;
}
