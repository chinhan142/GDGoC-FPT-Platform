import { Controller } from '@nestjs/common';
import { TenuresService } from './tenures.service';

@Controller('tenures')
export class TenuresController {
  constructor(private readonly tenuresService: TenuresService) {}
}
