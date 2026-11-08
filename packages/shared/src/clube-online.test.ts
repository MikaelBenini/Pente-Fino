import { describe, expect, it } from 'vitest';
import {
  assinarClubeSchema,
  dadosRecebimentoSchema,
  dividirRepasse,
  lerConfigClubeOnline,
  percentualDaBarbearia,
  planosSugeridos,
  textoConviteClube,
} from './clube-online.js';

describe('clube online', () => {
  it('taxa padrão de 1% e configuração inválida volta ao padrão', () => {
    expect(lerConfigClubeOnline(undefined)).toEqual({ taxaBp: 100 });
    expect(lerConfigClubeOnline({ taxaBp: 250 })).toEqual({ taxaBp: 250 });
    expect(lerConfigClubeOnline({ taxaBp: 5000 })).toEqual({ taxaBp: 100 });
  });

  it('repasse: a barbearia fica com o líquido menos a taxa; percentual do split', () => {
    expect(dividirRepasse(9_501, 100)).toEqual({ barbearia: 9_406, plataforma: 95 });
    expect(dividirRepasse(9_501, 0)).toEqual({ barbearia: 9_501, plataforma: 0 });
    expect(percentualDaBarbearia(150)).toBe(98.5);
    expect(percentualDaBarbearia(0)).toBe(100);
  });

  it('dados da conta para receber: CPF com nascimento; CNPJ com tipo de empresa', () => {
    const base = {
      nome: 'Barbearia do Carlos',
      email: 'carlos@x.com',
      telefone: '(11) 98888-7777',
      faturamentoMensal: 2_000_000,
      cep: '01310-100',
      endereco: 'Av. Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
    };
    expect(
      dadosRecebimentoSchema.safeParse({ ...base, tipo: 'pf', documento: '123.456.789-09' })
        .success,
    ).toBe(false);
    expect(
      dadosRecebimentoSchema.safeParse({
        ...base,
        tipo: 'pf',
        documento: '123.456.789-09',
        nascimento: '1990-05-01',
      }).success,
    ).toBe(true);
    expect(
      dadosRecebimentoSchema.safeParse({ ...base, tipo: 'pj', documento: '12.345.678/0001-90' })
        .success,
    ).toBe(false);
  });

  it('assinatura pelo link: WhatsApp com DDD vira 55…, CPF só números, e-mail opcional', () => {
    const r = assinarClubeSchema.parse({
      itemClubeId: '01a1b8fd-7922-755f-a75d-002b30602d99',
      nome: 'João Silva',
      telefone: '(11) 98888-7777',
      cpf: '123.456.789-09',
      email: '',
    });
    expect(r).toMatchObject({ telefone: '5511988887777', cpf: '12345678909', email: undefined });
  });

  it('planos sugeridos a partir dos serviços com preço', () => {
    const p = planosSugeridos([
      { id: 'c', nome: 'Corte', preco: 4500 },
      { id: 'b', nome: 'Barba', preco: 3000 },
    ]);
    expect(p.map((x) => x.nome)).toEqual([
      'Clube Corte',
      'Clube Corte + Barba',
      'Clube Corte à vontade',
    ]);
    expect(p[0]!.valor).toBe(14_990);
    expect(planosSugeridos([{ id: 'b', nome: 'Barba', preco: 3000 }])).toEqual([]);
  });

  it('mensagem do WhatsApp com o primeiro nome, o plano, o valor e o link', () => {
    const t = textoConviteClube({
      cliente: 'João Silva',
      barbearia: 'Barbearia do Carlos',
      plano: 'Clube Corte',
      valor: 14_990,
      link: 'https://seupentefino.com.br/assinar?u=centro&p=1',
    });
    expect(t).toContain('Oi, João!');
    expect(t).toContain('*Clube Corte*');
    expect(t).toMatch(/R\$\s?149,90/);
    expect(t).toContain('https://seupentefino.com.br/assinar?u=centro&p=1');
  });
});
