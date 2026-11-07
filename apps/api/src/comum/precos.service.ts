import { Inject, Injectable } from '@nestjs/common';
import { configuracaoDoSistema } from '@pente-fino/db';
import {
  dataLocal,
  lerConfiguracaoPublica,
  TABELA_PADRAO,
  tabelaVigente,
  type TabelaPrecosPlanos,
} from '@pente-fino/shared';
import { BancoService } from './banco.service.js';

const RELER_MS = 60_000;

/**
 * Tabelas de preço dos planos (cadastradas na administração, com vigência). Cada conta paga pela
 * tabela da data em que contratou; assinar ou trocar de plano é contrato novo (tabela do dia).
 */
@Injectable()
export class PrecosService {
  private guardadas?: { ate: number; tabelas: TabelaPrecosPlanos[] };

  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  async tabelas(): Promise<TabelaPrecosPlanos[]> {
    if (this.guardadas && this.guardadas.ate > Date.now()) return this.guardadas.tabelas;
    const tabelas = await configuracaoDoSistema(this.banco.prisma)
      .then((c) => lerConfiguracaoPublica(c).tabelasPreco)
      .catch(() => [TABELA_PADRAO]);
    this.guardadas = { ate: Date.now() + RELER_MS, tabelas };
    return tabelas;
  }

  /** A tabela de uma data (AAAA-MM-DD ou Date do banco); null = a do lançamento. */
  async vigente(data: string | Date | null): Promise<TabelaPrecosPlanos> {
    const dia = data instanceof Date ? data.toISOString().slice(0, 10) : data;
    return tabelaVigente(await this.tabelas(), dia);
  }

  /** Hoje em São Paulo, como data do banco (para gravar em conta.precos_desde). */
  hoje(): Date {
    return new Date(`${dataLocal(new Date())}T00:00:00Z`);
  }

  /** A administração mudou as tabelas: vale na hora. */
  esquecer(): void {
    this.guardadas = undefined;
  }
}
