import { Test } from '@nestjs/testing';
import { SinalVitalService } from './sinal-vital.service.js';
import { WorkerModule } from './worker.module.js';

describe('WorkerModule', () => {
  it('sobe o contexto sem servidor HTTP e encerra limpo', async () => {
    const modulo = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    await modulo.init();

    expect(modulo.get(SinalVitalService).estaAtivo()).toBe(true);

    await modulo.close();
  });
});
