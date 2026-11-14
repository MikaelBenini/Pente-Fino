// O que o visitante faz na página de vendas (pedido do dono em 13/11). O site grava eventos
// anônimos (rota pública, com o limite padrão por IP); a administração lê o resumo do dia e da
// semana. Tabela só da plataforma, sem dado pessoal.
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Injectable,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  dataLocal,
  instanteLocal,
  loteVisitaSchema,
  resumirVisitas,
  visitasPorDia,
  type LoteVisita,
  type PainelVisitas,
  type VisitaResumida,
} from '@pente-fino/shared';
import { AdminGuard, PapeisPlataforma } from '../admin/admin.guard.js';
import { BancoPlataforma } from '../admin/banco-plataforma.js';
import { Publico } from '../auth/decoradores.js';
import { Corpo } from '../comum/validacao.js';

@Injectable()
export class VisitasService {
  constructor(@Inject(BancoPlataforma) private readonly banco: BancoPlataforma) {}

  async registrar(d: LoteVisita): Promise<void> {
    await this.banco.prisma.eventoVisitaSite.createMany({
      data: d.eventos.map((e) => ({
        visitaId: d.visitaId,
        novo: d.novo,
        origem: d.origem,
        tipo: e.tipo,
        pagina: e.pagina,
        valor: 'valor' in e ? String(e.valor) : null,
      })),
    });
  }

  async painel(agora = new Date()): Promise<PainelVisitas> {
    const hoje = dataLocal(agora);
    const dias = Array.from({ length: 7 }, (_, i) =>
      dataLocal(new Date(instanteLocal(hoje, 12 * 60).getTime() - (6 - i) * 86_400_000)),
    );
    const desde = instanteLocal(dias[0]!, 0);
    // Uma linha por visita: quando começou, se é nova, de onde veio, até onde rolou e os cliques.
    const linhas = await this.banco.prisma.$queryRaw<
      {
        inicio: Date;
        novo: boolean | null;
        origem: string | null;
        rolou: number | null;
        cliques: string[] | null;
      }[]
    >`
      SELECT min(criado_em) AS inicio,
             bool_or(novo) AS novo,
             max(origem) AS origem,
             max(CASE WHEN tipo = 'rolagem' THEN valor::int END) AS rolou,
             array_agg(DISTINCT valor) FILTER (WHERE tipo = 'clique') AS cliques
        FROM evento_visita_site
       WHERE criado_em >= ${desde}
       GROUP BY visita_id`;
    const visitas: VisitaResumida[] = linhas.map((l) => ({
      inicio: l.inicio.toISOString(),
      novo: l.novo,
      origem: l.origem,
      rolou: l.rolou ?? 0,
      cliques: l.cliques ?? [],
    }));
    const inicioHoje = instanteLocal(hoje, 0).getTime();
    return {
      hoje: resumirVisitas(visitas.filter((v) => new Date(v.inicio).getTime() >= inicioHoje)),
      semana: resumirVisitas(visitas),
      porDia: visitasPorDia(visitas, dias),
    };
  }
}

@ApiTags('Site')
@Controller('visitas')
@Publico()
export class VisitasPublicoController {
  constructor(@Inject(VisitasService) private readonly visitas: VisitasService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eventos anônimos da visita à página de vendas (entrada, rolagem, clique)',
  })
  registrar(@Corpo(loteVisitaSchema) d: LoteVisita): Promise<void> {
    return this.visitas.registrar(d);
  }
}

@ApiTags('Administração do sistema')
@ApiBearerAuth()
@Controller('admin/visitas')
@Publico()
@UseGuards(AdminGuard)
export class AdminVisitasController {
  constructor(@Inject(VisitasService) private readonly visitas: VisitasService) {}

  @Get()
  @PapeisPlataforma('admin')
  @ApiOperation({ summary: 'Visitantes da página de vendas: hoje, 7 dias e o funil' })
  painel(): Promise<PainelVisitas> {
    return this.visitas.painel();
  }
}
