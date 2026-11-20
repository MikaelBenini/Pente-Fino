// Inscrição do aparelho nas notificações (push do PWA), usada pelo painel e pela administração.
// Pedido do dono em 20/11/2026: "ao clicar em ativar notificação e testar, não faz nada". O erro
// do navegador sumia atrás de uma mensagem genérica; agora cada motivo conhecido vira um passo
// claro, e o aparelho inscrito com uma chave antiga do servidor é refeito sozinho.

export const pushSuportado = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** Chave VAPID (base64url) no formato que o navegador pede. */
export function chaveDoServidor(base64: string): Uint8Array<ArrayBuffer> {
  const b = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const bruto = atob(b);
  const saida = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i);
  return saida;
}

function mesmaChave(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return true; // o navegador não informa: confia na inscrição que existe
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

/** Erro com o texto que a tela mostra (o motivo e o que fazer). */
export class ErroPush extends Error {}

/** Texto para a pessoa a partir do erro do navegador. */
export function motivoDoErroPush(e: unknown): string {
  if (e instanceof ErroPush) return e.message;
  const nome = e instanceof DOMException || e instanceof Error ? e.name : '';
  const texto = e instanceof Error ? e.message : String(e);
  if (nome === 'NotAllowedError')
    return 'O navegador bloqueou as notificações deste site. Toque no cadeado ao lado do endereço, libere "Notificações" e tente de novo.';
  if (nome === 'AbortError' || /push service/i.test(texto))
    return 'O serviço de notificações do navegador não respondeu. No Brave, abra Configurações → Privacidade e segurança e ligue "Usar os serviços do Google para mensagens push". Em aba anônima não funciona. No iPhone, abra pelo app instalado na tela de início.';
  if (nome === 'InvalidStateError')
    return 'Este aparelho tinha uma inscrição antiga. Toque de novo em ligar.';
  return `Não foi possível ligar neste aparelho${texto ? ` (${nome || 'erro'}: ${texto})` : ''}.`;
}

/**
 * Pede a permissão, garante o service worker ativo e devolve a inscrição deste aparelho com a
 * chave atual do servidor. Inscrição com outra chave (o servidor trocou as chaves) é refeita.
 */
export async function inscreverAparelho(chavePublica: string): Promise<PushSubscription> {
  if (!pushSuportado())
    throw new ErroPush(
      'Este navegador não recebe notificações. No iPhone, adicione o app à tela de início e abra por lá.',
    );
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted')
    throw new ErroPush(
      permissao === 'denied'
        ? 'O navegador bloqueou as notificações deste site. Toque no cadeado ao lado do endereço, libere "Notificações" e tente de novo.'
        : 'Para ligar, toque em "Permitir" quando o navegador perguntar.',
    );
  const registro =
    (await navigator.serviceWorker.getRegistration('/')) ??
    (await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }));
  // O service worker precisa estar ativo; se não ficar em 15 s, avisa em vez de girar para sempre.
  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, recusar) =>
      setTimeout(
        () =>
          recusar(
            new ErroPush(
              'O app ainda está terminando de instalar neste aparelho. Recarregue a página e tente de novo.',
            ),
          ),
        15_000,
      ),
    ),
  ]);
  const chave = chaveDoServidor(chavePublica);
  const atual = await registro.pushManager.getSubscription();
  if (atual && mesmaChave(atual.options.applicationServerKey, chave)) return atual;
  if (atual) await atual.unsubscribe();
  try {
    return await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chave,
    });
  } catch (e) {
    // Sobrou uma inscrição com outra chave: tira e tenta uma vez mais.
    if (e instanceof DOMException && e.name === 'InvalidStateError') {
      await (await registro.pushManager.getSubscription())?.unsubscribe();
      return registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
    }
    throw e;
  }
}
