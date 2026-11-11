import { describe, expect, it } from 'vitest';
import {
  avisoGeralSchema,
  avisoVigente,
  lerConfiguracaoPublica,
  ipInterno,
  mascararEmail,
  normalizarIp,
} from './configuracao-sistema.js';
import { DIAS_TESTE, TABELA_PADRAO, VERSAO_TERMOS } from './planos.js';
import { NOTA_FISCAL_PADRAO } from './nota-fiscal.js';

describe('configurações do sistema', () => {
  const aviso = {
    texto: 'Manutenção programada no domingo às 23 h.',
    tom: 'manutencao' as const,
    inicio: '2026-11-10T00:00:00-03:00',
    fim: '2026-11-17T00:00:00-03:00',
  };

  it('sem nada configurado: padrões do sistema', () => {
    expect(lerConfiguracaoPublica(null)).toEqual({
      avisoGeral: null,
      teste: { dias: DIAS_TESTE, versaoTermos: VERSAO_TERMOS },
      modelosEmail: {},
      tabelasPreco: [TABELA_PADRAO],
      clubeOnline: { taxaBp: 100 },
      notaFiscal: NOTA_FISCAL_PADRAO,
    });
    expect(lerConfiguracaoPublica({ teste: { dias: 999 } }).teste.dias).toBe(DIAS_TESTE);
  });

  it('aviso geral: só entre o início e o fim; fim antes do início é recusado', () => {
    const c = lerConfiguracaoPublica({ aviso_geral: aviso, teste: { dias: 7 } });
    expect(c.teste).toEqual({ dias: 7, versaoTermos: VERSAO_TERMOS });
    expect(avisoVigente(c.avisoGeral, new Date('2026-11-09T12:00:00Z'))).toBeNull();
    expect(avisoVigente(c.avisoGeral, new Date('2026-11-12T12:00:00Z'))?.tom).toBe('manutencao');
    expect(avisoVigente(c.avisoGeral, new Date('2026-11-17T03:00:00Z'))).toBeNull();
    expect(avisoGeralSchema.safeParse({ ...aviso, fim: aviso.inicio }).success).toBe(false);
  });
});

describe('SMTP configurável', () => {
  it('a tela nunca vê a senha; lixo guardado vira "usar o .env"', async () => {
    const { smtpParaTela, smtpEntradaSchema } = await import('./configuracao-sistema.js');
    expect(
      smtpParaTela({
        host: 'smtp.exemplo.com',
        porta: 587,
        seguro: false,
        usuario: 'apikey',
        remetente: 'Pente Fino <nao-responda@pentefino.com.br>',
        senhaCifrada: 'abc',
      }),
    ).toEqual({
      host: 'smtp.exemplo.com',
      porta: 587,
      seguro: false,
      usuario: 'apikey',
      remetente: 'Pente Fino <nao-responda@pentefino.com.br>',
      temSenha: true,
    });
    expect(smtpParaTela({ host: 'x' })).toBeNull();
    expect(
      smtpEntradaSchema.parse({ host: 'smtp.x.com', porta: 465, seguro: true, remetente: 'a@b.c' }),
    ).toMatchObject({ senha: null, usuario: '' });
  });
});

describe('falhas de e-mail e IP de quem acessa (admin R7 e R9)', () => {
  it('destinatário mascarado: dá para reconhecer sem expor o endereço', () => {
    expect(mascararEmail('joao.silva@gmail.com')).toBe('jo***@gmail.com');
    expect(mascararEmail('a@b.com')).toBe('a***@b.com');
    expect(mascararEmail('sem-arroba')).toBe('***');
  });

  it('IP interno (Docker, localhost, rede privada) não é o do visitante', () => {
    for (const ip of [
      '172.18.0.1',
      '10.0.0.5',
      '192.168.1.10',
      '127.0.0.1',
      '::1',
      '::ffff:172.18.0.1',
      'fd00::1',
    ])
      expect(ipInterno(ip), ip).toBe(true);
    for (const ip of ['200.150.10.20', '172.32.0.1', '2804:14c::1', null])
      expect(ipInterno(ip), String(ip)).toBe(false);
    expect(normalizarIp('::ffff:200.150.10.20')).toBe('200.150.10.20');
    expect(normalizarIp(' ')).toBeNull();
  });
});
