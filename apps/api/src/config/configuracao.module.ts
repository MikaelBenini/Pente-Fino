import { Global, Module } from '@nestjs/common';
import { CONFIGURACAO, carregarConfiguracao } from './configuracao.js';

@Global()
@Module({
  providers: [{ provide: CONFIGURACAO, useFactory: () => carregarConfiguracao() }],
  exports: [CONFIGURACAO],
})
export class ConfiguracaoModule {}
