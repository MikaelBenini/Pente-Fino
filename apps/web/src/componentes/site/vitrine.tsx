/**
 * Fotos das telas (apps/web/video/telas.mjs): tamanho real, para a página não pular. Site D1:
 * cada uma tem a versão com metade da largura (video/variantes.mjs), que o celular baixa pelo
 * srcset no lugar da grande.
 */
export const TELAS = {
  financeiro: { src: '/site/financeiro.webp', w: 1600, h: 844 },
  agenda: { src: '/site/agenda.webp', w: 1600, h: 1000 },
  metas: { src: '/site/metas.webp', w: 1600, h: 844 },
  lucroProdutos: { src: '/site/lucro-produtos.webp', w: 1600, h: 1000 },
  celularComanda: { src: '/site/celular-comanda.webp', w: 780, h: 1328 },
  celularDesempenho: { src: '/site/celular-desempenho.webp', w: 780, h: 1328 },
} as const;
type Tela = (typeof TELAS)[keyof typeof TELAS];

/** A versão menor de uma foto: mesmo nome com a largura no fim. */
export const srcMenor = (t: Tela) => t.src.replace(/\.webp$/, `-${Math.round(t.w / 2)}.webp`);

/**
 * Foto de tela com srcset (a grande e a com metade da largura). Sem o otimizador do Next: as
 * versões já existem em public/site, e o servidor só entrega o arquivo.
 */
function FotoTela({
  tela,
  alt,
  sizes,
  prioridade,
  className,
}: {
  tela: Tela;
  alt: string;
  sizes: string;
  prioridade: boolean;
  className: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- srcset próprio, sem o otimizador
    <img
      src={tela.src}
      srcSet={`${srcMenor(tela)} ${Math.round(tela.w / 2)}w, ${tela.src} ${tela.w}w`}
      sizes={sizes}
      width={tela.w}
      height={tela.h}
      alt={alt}
      loading={prioridade ? 'eager' : 'lazy'}
      fetchPriority={prioridade ? 'high' : 'auto'}
      decoding="async"
      className={className}
    />
  );
}

/** Janela de navegador com uma tela do sistema. */
export function Janela({
  tela,
  alt,
  prioridade = false,
  className = '',
  sizes = '(min-width: 1024px) 640px, (min-width: 768px) 50vw, 100vw',
}: {
  tela: Tela;
  alt: string;
  prioridade?: boolean;
  className?: string;
  /** Largura em que a foto aparece (srcset). Padrão: até 640 px no computador, a tela toda no celular. */
  sizes?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-borda-forte bg-superficie shadow-[0_30px_80px_-30px_rgb(0_0_0/0.7)] ${className}`}
    >
      <div aria-hidden className="flex items-center gap-1.5 border-b border-borda px-3 py-2">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 truncate rounded bg-superficie-2 px-2 py-0.5 text-[11px] text-tinta-suave">
          seupentefino.com.br
        </span>
      </div>
      <FotoTela
        tela={tela}
        alt={alt}
        sizes={sizes}
        prioridade={prioridade}
        className="h-auto w-full"
      />
    </div>
  );
}

/** Celular com uma tela do app do barbeiro. */
export function Celular({
  tela,
  alt,
  className = '',
  prioridade = false,
  sizes = '(min-width: 640px) 16rem, 46vw',
}: {
  tela: Tela;
  alt: string;
  className?: string;
  prioridade?: boolean;
  sizes?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[2rem] border-[6px] border-[#26262b] bg-[#26262b] shadow-[0_30px_70px_-25px_rgb(0_0_0/0.8)] ${className}`}
    >
      <FotoTela
        tela={tela}
        alt={alt}
        sizes={sizes}
        prioridade={prioridade}
        className="h-auto w-full rounded-[1.6rem]"
      />
    </div>
  );
}

/** Topo: o painel no computador, o app do barbeiro no celular e a sobra do mês. */
export function Vitrine() {
  return (
    <div className="relative mx-auto w-full max-w-xl pb-10 md:max-w-none">
      <Janela
        tela={TELAS.financeiro}
        alt="Tela Financeiro do Pente Fino: faturamento de R$ 53.110, comissões, despesas e lucro do mês de R$ 10.729"
        prioridade
      />
      <Celular
        tela={TELAS.celularComanda}
        alt="App do barbeiro no celular: comanda com o total e os extras para lançar"
        className="absolute -bottom-2 -left-3 w-[30%] sm:-left-6 md:-left-10"
        sizes="(min-width: 768px) 15vw, 30vw"
        prioridade
      />
      <div className="absolute -right-2 -bottom-4 rounded-xl border border-modulo/40 bg-superficie/95 px-4 py-3 shadow-2xl backdrop-blur sm:-right-4">
        <p className="text-xs font-semibold tracking-widest text-tinta-suave uppercase">
          Sobrou em outubro
        </p>
        <p className="font-denso text-3xl font-bold text-modulo-texto tabular-nums">R$ 10.729</p>
        <p className="text-xs text-tinta-suave">depois de comissões e despesas</p>
      </div>
    </div>
  );
}

/** Conversa do bot (como o cliente vê no WhatsApp): marcar corte e barba, sem IA. */
export function ConversaWhatsapp() {
  const mensagens: { de: 'cliente' | 'bot'; texto: string }[] = [
    { de: 'cliente', texto: 'oi' },
    {
      de: 'bot',
      texto:
        'Olá, João! Aqui é a Barbearia do Carlos.\nComo posso ajudar?\n1. Agendar horário\n2. Ver preços\n3. Meus horários',
    },
    { de: 'cliente', texto: '1' },
    {
      de: 'bot',
      texto: 'Qual serviço você quer?\n1. Barba · R$ 30\n2. Corte · R$ 45\n3. Sobrancelha · R$ 15',
    },
    { de: 'cliente', texto: '2' },
    {
      de: 'bot',
      texto:
        '✅ Anotado: Corte · R$ 45\nQuer adicionar mais algum?\n1. Barba · R$ 30\n0. Não, escolher o horário',
    },
    { de: 'cliente', texto: '1' },
    {
      de: 'bot',
      texto: 'Horários livres amanhã:\n1. 09:30  2. 10:15  3. 14:00\n4. 15:30  5. 16:15',
    },
    { de: 'cliente', texto: '3' },
    {
      de: 'bot',
      texto: '✅ Marcado! Corte + Barba amanhã às 14:00 com Rafael. Te lembro antes. 💈',
    },
  ];
  return (
    <figure
      aria-label="Exemplo de conversa com o bot do WhatsApp marcando corte e barba"
      className="mx-auto w-full max-w-sm overflow-hidden rounded-[1.75rem] border-[6px] border-[#26262b] bg-[#0b141a] shadow-[0_30px_70px_-25px_rgb(0_0_0/0.8)]"
    >
      <div className="flex items-center gap-3 bg-[#1f2c34] px-4 py-3 text-white">
        <span className="grid size-9 place-items-center rounded-full bg-modulo font-denso font-bold text-[#0b0b0b]">
          BC
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Barbearia do Carlos</span>
          <span className="text-xs text-[#8696a0]">responde na hora</span>
        </span>
      </div>
      <ol className="flex flex-col gap-1.5 bg-[#0b141a] p-3 text-[13px] leading-snug">
        {mensagens.map((m, i) => (
          <li
            key={i}
            className={`max-w-[85%] whitespace-pre-line rounded-lg px-2.5 py-1.5 ${
              m.de === 'cliente'
                ? 'self-end bg-[#005c4b] text-white'
                : 'self-start bg-[#202c33] text-[#e9edef]'
            }`}
          >
            {m.texto}
          </li>
        ))}
      </ol>
    </figure>
  );
}
