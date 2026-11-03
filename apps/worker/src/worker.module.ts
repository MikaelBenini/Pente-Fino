import { Module } from '@nestjs/common';
import { SinalVitalService } from './sinal-vital.service.js';

@Module({
  providers: [SinalVitalService],
})
export class WorkerModule {}
