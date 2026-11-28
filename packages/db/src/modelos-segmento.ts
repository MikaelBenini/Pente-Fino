// Serviços prontos por segmento (Fase 1b, S8, 27/11/2026): a configuração guiada oferece os
// serviços do tipo de negócio da conta, com duração, custo de produto e preço sugerido (centavos;
// referência de mercado, o dono troca na tabela). Peso: principal 1, extra 0, combo = soma.
// Barbearia continua com o MODELO_SERVICOS de sempre (modelos.ts).
import type { Segmento } from '@pente-fino/shared';
import { MODELO_SERVICOS, type ModeloServico } from './modelos.js';

const servico = (
  nome: string,
  categoria: string,
  duracaoMin: number,
  custoProduto: number,
  precoSugerido: number,
  o: { extra?: boolean; peso?: number } = {},
): ModeloServico => ({
  nome,
  categoria,
  duracaoMin,
  custoProduto,
  precoSugerido,
  ehExtra: o.extra ?? false,
  pesoAtendimento: o.peso ?? (o.extra ? 0 : 1),
});

export const MODELOS_SERVICOS_POR_SEGMENTO: Readonly<Record<Segmento, readonly ModeloServico[]>> = {
  barbearia: MODELO_SERVICOS,
  salao: [
    servico('Corte feminino', 'Cabelo', 60, 300, 8000),
    servico('Corte masculino', 'Cabelo', 30, 150, 4500),
    servico('Escova', 'Cabelo', 45, 400, 5000),
    servico('Coloração', 'Química', 120, 3500, 15000),
    servico('Mechas', 'Química', 180, 5000, 25000),
    servico('Progressiva', 'Química', 180, 6000, 25000),
    servico('Corte + Escova', 'Combo', 90, 700, 12000, { peso: 2 }),
    servico('Hidratação', 'Tratamento', 45, 1200, 7000),
    servico('Finalização', 'Extras', 15, 200, 2500, { extra: true }),
  ],
  unhas: [
    servico('Manicure', 'Mãos', 45, 300, 3000),
    servico('Pedicure', 'Pés', 45, 300, 3500),
    servico('Mão e pé', 'Combo', 90, 600, 6000, { peso: 2 }),
    servico('Esmaltação em gel', 'Mãos', 60, 900, 7000),
    servico('Alongamento em gel', 'Mãos', 120, 2500, 15000),
    servico('Manutenção do alongamento', 'Mãos', 90, 1500, 10000),
    servico('Design de sobrancelha', 'Sobrancelha', 30, 200, 3500),
    servico('Spa dos pés', 'Extras', 20, 800, 2500, { extra: true }),
  ],
  estetica: [
    servico('Limpeza de pele', 'Facial', 60, 2000, 15000),
    servico('Peeling', 'Facial', 45, 3000, 18000),
    servico('Microagulhamento', 'Facial', 60, 5000, 30000),
    servico('Drenagem linfática', 'Corporal', 60, 800, 12000),
    servico('Massagem modeladora', 'Corporal', 60, 1000, 12000),
    servico('Depilação com cera (pernas)', 'Depilação', 40, 800, 7000),
    servico('Design de sobrancelha', 'Facial', 30, 200, 4000),
    servico('Máscara facial', 'Extras', 15, 1000, 3000, { extra: true }),
  ],
  tatuagem: [
    servico('Tatuagem pequena', 'Tatuagem', 60, 2000, 20000),
    servico('Tatuagem média', 'Tatuagem', 180, 4000, 50000),
    servico('Sessão de fechamento', 'Tatuagem', 300, 6000, 80000),
    servico('Retoque', 'Tatuagem', 60, 1000, 10000),
    servico('Piercing', 'Piercing', 30, 2500, 12000),
    servico('Troca de joia', 'Extras', 15, 1500, 4000, { extra: true }),
  ],
  academia: [
    servico('Aula avulsa', 'Aulas', 60, 0, 4000),
    servico('Avaliação física', 'Avaliação', 45, 0, 8000),
    servico('Aula com personal', 'Aulas', 60, 0, 10000),
    servico('Aula experimental', 'Aulas', 60, 0, 1000),
  ],
  personal: [
    servico('Treino personalizado', 'Treino', 60, 0, 12000),
    servico('Avaliação física', 'Avaliação', 60, 0, 10000),
    servico('Treino em dupla', 'Treino', 60, 0, 18000, { peso: 2 }),
    servico('Consultoria online', 'Online', 30, 0, 15000),
  ],
  outro: [
    servico('Atendimento', 'Geral', 60, 0, 10000),
    servico('Consulta', 'Geral', 60, 0, 15000),
    servico('Retorno', 'Geral', 30, 0, 8000),
  ],
};

/** Os serviços prontos do segmento (sem segmento conhecido, os de barbearia). */
export function modelosDeServico(segmento: Segmento | null | undefined): readonly ModeloServico[] {
  return (segmento && MODELOS_SERVICOS_POR_SEGMENTO[segmento]) || MODELO_SERVICOS;
}
