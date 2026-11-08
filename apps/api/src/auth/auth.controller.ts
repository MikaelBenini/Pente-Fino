import { Controller, Get, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  aceitarConviteSchema,
  esqueciSenhaSchema,
  loginSchema,
  redefinirSenhaSchema,
  renovarSessaoSchema,
  trocarSenhaSchema,
  type AceitarConviteEntrada,
  type EsqueciSenhaEntrada,
  type LoginEntrada,
  type RedefinirSenhaEntrada,
  type RenovarSessaoEntrada,
  type Sessao,
  type TrocarSenhaEntrada,
  type UsuarioSessao,
} from '@pente-fino/shared';
import { Auditada } from '../auditoria/auditoria.js';
import { Corpo } from '../comum/validacao.js';
import { AuthService } from './auth.service.js';
import { LimiteAutenticacao, LivreSemAssinatura, Publico } from './decoradores.js';

@ApiTags('Autenticação')
@LivreSemAssinatura()
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('login')
  @Publico()
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Entrar com e-mail e senha' })
  login(@Corpo(loginSchema) dados: LoginEntrada): Promise<Sessao> {
    return this.auth.login(dados);
  }

  @Post('renovar')
  @Publico()
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trocar o refreshToken por uma sessão nova (rotação)' })
  renovar(@Corpo(renovarSessaoSchema) { refreshToken }: RenovarSessaoEntrada): Promise<Sessao> {
    return this.auth.renovar(refreshToken);
  }

  @Post('sair')
  @Publico()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Encerrar a sessão do refreshToken' })
  sair(@Corpo(renovarSessaoSchema) { refreshToken }: RenovarSessaoEntrada): Promise<void> {
    return this.auth.sair(refreshToken);
  }

  @Get('eu')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuário logado, com conta e papéis' })
  eu(): Promise<UsuarioSessao> {
    return this.auth.eu();
  }

  @Post('reenviar-confirmacao')
  @ApiBearerAuth()
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mandar de novo o link de confirmação do e-mail' })
  reenviarConfirmacao(): Promise<{ enviado: boolean }> {
    return this.auth.reenviarConfirmacao();
  }

  @Post('esqueci-senha')
  @Publico()
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Enviar link de redefinição de senha por e-mail' })
  async esqueciSenha(@Corpo(esqueciSenhaSchema) { email }: EsqueciSenhaEntrada) {
    await this.auth.esqueciSenha(email);
    return {
      mensagem:
        'Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.',
    };
  }

  @Post('redefinir-senha')
  @Publico()
  @LimiteAutenticacao()
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Criar nova senha com o link recebido por e-mail' })
  redefinirSenha(@Corpo(redefinirSenhaSchema) dados: RedefinirSenhaEntrada): Promise<void> {
    return this.auth.redefinirSenha(dados);
  }

  @Post('trocar-senha')
  @LimiteAutenticacao()
  @Auditada()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trocar a senha informando a atual (encerra as outras sessões)' })
  trocarSenha(@Corpo(trocarSenhaSchema) dados: TrocarSenhaEntrada): Promise<Sessao> {
    return this.auth.trocarSenha(dados);
  }

  @Post('convite')
  @Publico()
  @LimiteAutenticacao()
  @Auditada()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aceitar convite criando a senha' })
  aceitarConvite(@Corpo(aceitarConviteSchema) dados: AceitarConviteEntrada): Promise<Sessao> {
    return this.auth.aceitarConvite(dados);
  }
}
