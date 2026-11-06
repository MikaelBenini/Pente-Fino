-- Textos editáveis novos do bot: abertura dos lembretes e o aviso de que a equipe não respondeu.
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'lembrete_primeiro';
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'lembrete_segundo';
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'atendente_sem_resposta';
