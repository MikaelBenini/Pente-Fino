'use client';

// Vocabulário do segmento da conta na tela (Fase 1a, 27/11/2026): "barbeiro" para barbearia,
// "esteticista" para estética, "instrutor" para academia... Nenhum texto visível do painel fixa
// "barbeiro": usa este gancho. Fora da casca do app (páginas públicas), passe o segmento.
import {
  comArtigo,
  comVocabulario,
  maiuscula,
  vocabulario,
  type Papel,
  type Vocabulario,
} from '@pente-fino/shared';
import { use } from 'react';
import { Contexto } from '@/componentes/contexto-app';

export interface VocabularioTela extends Vocabulario {
  /** "Barbeiro", "Esteticista". */
  Profissional: string;
  /** "Barbeiros", "Esteticistas". */
  Profissionais: string;
  /** "Barbearia", "Clínica". */
  Estabelecimento: string;
  /** "a barbearia", "o salão". */
  oEstabelecimento: string;
  /** "da barbearia", "do salão". */
  doEstabelecimento: string;
  /** "o barbeiro", "a esteticista". */
  oProfissional: string;
  /** "do barbeiro", "da esteticista". */
  doProfissional: string;
  /** Texto com marcadores: t('Tente outro dia ou [[profissional]].'). */
  t: (texto: string) => string;
}

export function vocabularioDaTela(segmento: string | null | undefined): VocabularioTela {
  const v = vocabulario(segmento);
  const de = (t: Vocabulario['estabelecimento']) => `${t.feminino ? 'da' : 'do'} ${t.um}`;
  return {
    ...v,
    Profissional: maiuscula(v.profissional.um),
    Profissionais: maiuscula(v.profissional.muitos),
    Estabelecimento: maiuscula(v.estabelecimento.um),
    oEstabelecimento: comArtigo(v.estabelecimento),
    doEstabelecimento: de(v.estabelecimento),
    oProfissional: comArtigo(v.profissional),
    doProfissional: de(v.profissional),
    t: (texto) => comVocabulario(texto, v),
  };
}

/** O vocabulário da conta logada (barbearia quando não há sessão). */
export function useVocabulario(): VocabularioTela {
  const app = use(Contexto);
  return vocabularioDaTela(app?.usuario.segmento);
}

/** Nome do papel na tela: o profissional aparece com o nome do segmento ("Barbeiro", "Esteticista"). */
export function nomeDoPapel(papel: Papel, v: VocabularioTela): string {
  return { dono: 'Dono', gestor: 'Gestor', recepcao: 'Recepção', profissional: v.Profissional }[
    papel
  ];
}

export function useNomePapel(): (papel: Papel) => string {
  const v = useVocabulario();
  return (papel) => nomeDoPapel(papel, v);
}
