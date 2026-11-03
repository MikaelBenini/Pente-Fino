import { Inject, Injectable } from '@nestjs/common';
import { FUSO_EXIBICAO, type TrabalhoEmail } from '@pente-fino/shared';
import { Filas } from '../filas/filas.module.js';

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function dataHora(d: Date): string {
  return d.toLocaleString('pt-BR', {
    timeZone: FUSO_EXIBICAO,
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/** Monta o e-mail com texto puro e HTML simples (cliente de e-mail não lê CSS externo). */
function montar(
  para: string,
  assunto: string,
  paragrafos: string[],
  botao?: { texto: string; link: string },
): TrabalhoEmail {
  const texto = [
    ...paragrafos,
    ...(botao ? [`${botao.texto}: ${botao.link}`] : []),
    '',
    '— Pente Fino',
  ].join('\n\n');
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
${paragrafos.map((p) => `<p style="font-size:16px;line-height:1.5;margin:0 0 16px">${escapar(p)}</p>`).join('\n')}
${botao ? `<p style="margin:24px 0"><a href="${escapar(botao.link)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold">${escapar(botao.texto)}</a></p><p style="font-size:13px;color:#52525b;word-break:break-all">Se o botão não abrir, copie este endereço: ${escapar(botao.link)}</p>` : ''}
<p style="font-size:13px;color:#71717a;margin-top:32px">Pente Fino</p></div></body></html>`;
  return { para, assunto, texto, html };
}

/** Textos dos e-mails do sistema. O envio é do worker (fila "emails"). */
@Injectable()
export class EmailsService {
  constructor(@Inject(Filas) private readonly filas: Filas) {}

  private async enfileirar(email: TrabalhoEmail): Promise<void> {
    await this.filas.emails.add('enviar', email);
  }

  convite(d: {
    para: string;
    nome: string;
    conta: string;
    convidadoPor: string;
    link: string;
    expiraEm: Date;
  }) {
    return this.enfileirar(
      montar(
        d.para,
        `Convite para a equipe da ${d.conta}`,
        [
          `Olá, ${d.nome}!`,
          `${d.convidadoPor} convidou você para usar o Pente Fino na ${d.conta}.`,
          `Crie sua senha pelo botão abaixo. O convite vale até ${dataHora(d.expiraEm)}.`,
        ],
        { texto: 'Aceitar convite', link: d.link },
      ),
    );
  }

  redefinirSenha(d: { para: string; nome: string; link: string }) {
    return this.enfileirar(
      montar(
        d.para,
        'Redefinir sua senha',
        [
          `Olá, ${d.nome}!`,
          'Recebemos um pedido para redefinir sua senha. O link vale por 1 hora e só pode ser usado uma vez.',
          'Se não foi você, ignore este e-mail: sua senha continua a mesma.',
        ],
        { texto: 'Criar nova senha', link: d.link },
      ),
    );
  }

  senhaAlterada(d: { para: string; nome: string }) {
    return this.enfileirar(
      montar(d.para, 'Sua senha foi alterada', [
        `Olá, ${d.nome}!`,
        `Sua senha do Pente Fino foi alterada em ${dataHora(new Date())}. Por segurança, as outras sessões foram encerradas.`,
        'Se não foi você, fale agora com o dono da barbearia.',
      ]),
    );
  }
}
