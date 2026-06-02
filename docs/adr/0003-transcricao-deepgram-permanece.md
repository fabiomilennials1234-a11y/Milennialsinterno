# 0003 — Transcrição de Reunião Gravada: Deepgram permanece (OpenRouter STT inviável no edge)

- **Status:** Aceito
- **Data:** 2026-06-02
- **Decisores:** Fundador/CTO
- **Supersede:** [[0002-transcricao-openrouter-chirp3]]
- **Relacionado:** [[0001-reuniao-gravada-browser-document-pip]]

## Contexto

ADR-0002 decidiu consolidar a transcrição no OpenRouter (Groq Whisper) para ter um vendor/key só.
Na implementação (issue #70), três fatos derrubaram a premissa:

1. **OOM no edge.** O endpoint STT do OpenRouter (`/api/v1/audio/transcriptions`) aceita **somente
   base64 em JSON, sem upload streaming/multipart**. Transcrever exige carregar o áudio inteiro em
   memória + a string base64 (~1.34x) + cópia no body JSON. Áudio de ~10MB já mata o edge worker
   (`Memory limit exceeded`) **antes do catch** → sessão trava em `processing`. Reunião real de
   30-60min é »6MB → nunca cabe no orçamento de memória do edge.
2. **Roteamento Groq quebrado.** Mesmo abaixo do teto, o OpenRouter devolve `400` genérico para o
   slug roteado ao Groq.
3. **Deepgram é URL-based.** A implementação Deepgram passa a **URL** do áudio; o Deepgram busca o
   arquivo sozinho — **zero áudio na memória do nosso edge**. Por isso nunca deu OOM e aguenta 2h.

Consolidar num vendor só era o **único** motivo de sair do Deepgram. Como qualquer caminho resulta
em 2 vendors mesmo (STT + OpenRouter para a ata LLM), a consolidação nunca foi alcançável.

## Decisão

**Deepgram permanece como provider de transcrição.** Reverter o swap OpenRouter/Groq da edge fn
`transcribe-meeting`, restaurando a chamada Deepgram (URL-based, Nova-2, pt-BR, diarização).

Manter, independentemente, os dois fixes ortogonais descobertos durante a tentativa:
- **Auth service-role para chaves novas.** A plataforma migrou para `sb_secret_...` (opaca, não-JWT).
  Edge fns com `verify_jwt=true` rejeitavam a chave nova como JWT (401 antes do código) → o
  **reconciler nunca conseguia re-disparar transcrição/ata**. Corrigido: `verify_jwt=false` em
  `transcribe-meeting`/`generate-meeting-ata`/`reconcile-recordings` + helper `_shared/internalAuth.ts`
  (aceita secret nova E JWT legado, constant-time compare). **Rede de durabilidade do reconciler
  estava furada; este fix é essencial e fica.**
- **Endurecimento do container WebM** (ADR-0001 emenda / issue #73).

## Diarização não é requisito

O fundador confirmou: **não precisamos de diarização.** O objetivo é só a transcrição do áudio em
texto + os resumos/tópicos/ata (que já foram construídos e consomem apenas `transcript.text`). Logo
a decisão STT **não** se apoia em diarização — apoia-se exclusivamente em **funcionar no edge sem OOM**
e **simplicidade** (zero código novo). Deepgram entrega texto de forma URL-based que cabe no edge;
se ele emitir `segments`/speaker como bônus, é incidental e ignorado pela ata. Não é feature.

## Consequências

- **Positivo:** transcrição volta a funcionar para reuniões de até 2h (URL-based, sem OOM); zero
  código STT novo; o fix de durabilidade do reconciler (que estava quebrado em silêncio) é mantido.
  A ata/tópicos/resumo já construídos passam a rodar de fato, em cima do `transcript.text`.
- **Custo aceito:** dois vendors (Deepgram para STT + OpenRouter para a ata LLM) e duas chaves. Era
  inevitável de qualquer forma.
- **Diarização:** não requerida. Se o Deepgram retornar speakers, é ignorado — a ata usa só o texto.

## Alternativas consideradas

- **Groq direto (multipart streaming).** `api.groq.com/openai/v1/audio/transcriptions` aceita upload
  streaming → resolve o OOM, e é o Whisper que o ADR-0002 queria. Rejeitado: exige `GROQ_API_KEY`
  novo + código + teste live novos, sem diarização, para ganho marginal de custo sobre um Deepgram
  que já funciona. Reabrir só se custo de transcrição virar gargalo real.
- **Mover STT para fora do edge** (runtime com memória real). Maior lift, adia entrega. Overkill agora.
