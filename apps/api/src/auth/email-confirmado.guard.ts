// Até confirmar o e-mail (cadastro pelo site, Etapa 15.4), a conta não agenda, não convida a
// equipe nem conecta o WhatsApp: são o que um robô usaria para abusar do sistema.
import { type CanActivate, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { ErroApp } from '../comum/erros.js';

export const MENSAGEM_CONFIRMAR_EMAIL =
  'Confirme seu e-mail para liberar a agenda, os convites e o WhatsApp. Mandamos o link quando a conta foi criada; em Início dá para pedir de novo.';

@Injectable()
export class EmailConfirmadoGuard implements CanActivate {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  async canActivate(): Promise<boolean> {
    const { id } = Contexto.usuario();
    const u = await this.banco.daConta((tx) =>
      tx.usuario.findUnique({ where: { id }, select: { emailConfirmadoEm: true } }),
    );
    if (u?.emailConfirmadoEm) return true;
    throw new ErroApp(HttpStatus.FORBIDDEN, 'email_nao_confirmado', MENSAGEM_CONFIRMAR_EMAIL);
  }
}
