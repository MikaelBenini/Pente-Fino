import { describe, expect, it } from 'vitest';
import { ProvedorEvolution } from './evolution.js';
import { ErroProvedorWhatsApp } from './provedor.js';

type Chamada = { metodo: string; caminho: string; corpo: unknown; chave: string | null };

/** Evolution de mentira: responde por "METODO /caminho". */
function evolution(respostas: Record<string, [number, unknown]>) {
  const chamadas: Chamada[] = [];
  const buscar = (async (url: string, init: RequestInit) => {
    const caminho = url.replace('http://evo', '');
    const metodo = init.method ?? 'GET';
    chamadas.push({
      metodo,
      caminho,
      corpo: init.body ? JSON.parse(init.body as string) : undefined,
      chave: (init.headers as Record<string, string>).apikey ?? null,
    });
    const [status, corpo] = respostas[`${metodo} ${caminho}`] ?? [
      404,
      { response: { message: 'x' } },
    ];
    return new Response(JSON.stringify(corpo), { status });
  }) as unknown as typeof fetch;
  const provedor = new ProvedorEvolution({
    url: 'http://evo/',
    chave: 'k',
    fetch: buscar,
    cabecalhosWebhook: (i) => ({ 'x-pente-fino-assinatura': `ass-${i}` }),
  });
  return { provedor, chamadas };
}

describe('ProvedorEvolution', () => {
  it('conectar cria a instância, aponta o webhook com a assinatura e devolve o QR', async () => {
    let criada = false;
    const chamadas: Chamada[] = [];
    const respostas: Record<string, [number, unknown]> = {
      'POST /instance/create': [201, {}],
      'POST /webhook/set/pf-1': [201, {}],
      'GET /instance/connect/pf-1': [200, { base64: 'data:image/png;base64,QR' }],
    };
    // connectionState: 404 antes de criar, "close" depois.
    const p = new ProvedorEvolution({
      url: 'http://evo',
      chave: 'k',
      cabecalhosWebhook: (i) => ({ 'x-pente-fino-assinatura': `ass-${i}` }),
      fetch: (async (url: string, init: RequestInit) => {
        const caminho = url.replace('http://evo', '');
        const chave = `${init.method} ${caminho}`;
        chamadas.push({
          metodo: init.method!,
          caminho,
          corpo: init.body && JSON.parse(init.body as string),
          chave: null,
        });
        if (chave === 'POST /instance/create') criada = true;
        if (caminho === '/instance/connectionState/pf-1')
          return criada
            ? Response.json({ instance: { state: 'close' } })
            : Response.json({}, { status: 404 });
        const [status, corpo] = respostas[chave] ?? [404, {}];
        return Response.json(corpo, { status });
      }) as unknown as typeof fetch,
    });
    const estado = await p.conectar('pf-1', 'http://api/webhooks/whatsapp');
    expect(estado).toEqual({
      status: 'aguardando_qr',
      numero: null,
      qr: 'data:image/png;base64,QR',
    });
    const webhook = chamadas.find((c) => c.caminho === '/webhook/set/pf-1');
    expect(webhook?.corpo).toMatchObject({
      webhook: {
        enabled: true,
        url: 'http://api/webhooks/whatsapp',
        headers: { 'x-pente-fino-assinatura': 'ass-pf-1' },
      },
    });
  });

  it('estado conectado traz o número do dono da instância', async () => {
    const { provedor } = evolution({
      'GET /instance/connectionState/pf-1': [200, { instance: { state: 'open' } }],
      'GET /instance/fetchInstances?instanceName=pf-1': [
        200,
        [{ name: 'pf-1', ownerJid: '5511911112222@s.whatsapp.net' }],
      ],
    });
    expect(await provedor.estado('pf-1')).toEqual({
      status: 'conectado',
      numero: '5511911112222',
      qr: null,
    });
  });

  it('instância que não existe está desconectada', async () => {
    const { provedor } = evolution({});
    expect(await provedor.estado('nada')).toEqual({
      status: 'desconectado',
      numero: null,
      qr: null,
    });
    await expect(provedor.desconectar('nada')).resolves.toBeUndefined();
  });

  it('envia texto com a chave e devolve o id da mensagem', async () => {
    const { provedor, chamadas } = evolution({
      'POST /message/sendText/pf-1': [201, { key: { id: 'MSG1' } }],
    });
    expect(await provedor.enviarTexto('pf-1', '5511988887777', 'oi')).toEqual({
      idExterno: 'MSG1',
    });
    expect(chamadas[0]).toMatchObject({
      corpo: { number: '5511988887777', text: 'oi' },
      chave: 'k',
    });
  });

  it('erro da Evolution vira ErroProvedorWhatsApp com o status', async () => {
    const { provedor } = evolution({
      'POST /message/sendText/pf-1': [500, { response: { message: 'Connection Closed' } }],
    });
    const erro = await provedor.enviarTexto('pf-1', '5511', 'oi').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroProvedorWhatsApp);
    expect((erro as ErroProvedorWhatsApp).status).toBe(500);
    expect((erro as Error).message).toContain('Connection Closed');
  });

  it('Evolution fora do ar vira erro claro', async () => {
    const p = new ProvedorEvolution({
      url: 'http://evo',
      chave: 'k',
      fetch: (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
    });
    await expect(p.estado('pf-1')).rejects.toThrow(/não respondeu/);
  });
});
