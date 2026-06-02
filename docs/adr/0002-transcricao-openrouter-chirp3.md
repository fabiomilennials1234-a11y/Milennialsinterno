# 0002 — Transcrição de Reunião Gravada: OpenRouter + Groq Whisper (consolidar, sair do Deepgram)

- **Status:** ❌ SUPERSEDED por [[0003-transcricao-deepgram-permanece]] (2026-06-02)
- **Data:** 2026-06-02
- **Decisores:** Fundador/CTO
- **Relacionado:** [[0001-reuniao-gravada-browser-document-pip]]

> **SUPERSEDED.** Tentativa de consolidar transcrição no OpenRouter (Chirp 3 → emendado p/ Groq
> Whisper) falhou na implementação: o endpoint STT do OpenRouter aceita **só base64 em JSON, sem
> streaming** → estoura a memória do edge worker em áudio de reunião real (OOM em ~10MB; reunião de
> 30-60min é »6MB, nunca cabe), e ainda devolve 400 roteando Groq. Deepgram é **URL-based** (busca o
> áudio sozinho, zero memória no edge) — arquiteturalmente correto pro edge o tempo todo. Decisão
> revertida: Deepgram permanece. Detalhes em ADR-0003.

## Emenda (2026-06-02) — premissa de diarização corrigida

A versão original deste ADR escolheu **Google Chirp 3** com a justificativa de que "mantém
diarização". **Premissa falsa**, confirmada na doc oficial do OpenRouter: o endpoint
`/api/v1/audio/transcriptions` **achata a saída para texto corrido — não expõe diarização para
nenhum modelo**, Chirp 3 incluído (o modelo diariza na API nativa do Google Cloud STT, mas o
proxy do OpenRouter descarta os speakers). "Consolidar no OpenRouter" e "manter quem falou" são
**incompatíveis** por esse caminho — só dá pra ter diarização trazendo um terceiro vendor (Google
Cloud STT direto), o que mataria a consolidação.

Impacto real medido no código: a **ata** (`generate-meeting-ata`) usa só `transcript.text`, nunca
os speakers → perder diarização **não afeta a ata**. O único consumidor de `segments`/`speaker` é
o viewer de transcrição em `RecordedMeetingsPage`, que já degrada sozinho para texto corrido.

**Decisão emendada:** consolidar no OpenRouter usando **Groq Whisper** (mais barato/rápido que
Chirp 3, mesmo resultado de texto puro — sem diarização). Diarização é abandonada conscientemente;
custo = perda da coloração por voz no viewer de transcript, aceito pelo fundador ("escolhe por mim"
→ default world-class: o que importa é consolidar vendor + a ata).

## Contexto

A v2 da Reunião Gravada shipou com transcrição via **Deepgram Nova-2** (vendor + chave
separados) e geração de ata via **OpenRouter** (`claude-sonnet-4-5`). Em mai/2026 o OpenRouter
lançou endpoint dedicado de transcrição (`/api/v1/audio/transcriptions`), com providers OpenAI
Whisper/GPT-4o, **Google Chirp 3**, Groq Whisper e Mistral Voxtral.

Pergunta levantada: precisamos do Deepgram, ou dá pra transcrever no OpenRouter e ter um vendor só?

## Decisão (vigente após emenda)

**Consolidar a transcrição no OpenRouter usando Groq Whisper.** Sai o Deepgram. Sem diarização.

A ata não consome speakers, então a perda de diarização não toca o produto principal. Groq Whisper
dá o melhor custo/latência entre os modelos de texto-puro do OpenRouter.

## Alternativas consideradas

- **Manter Deepgram.** Melhor diarização pt-BR, porém vendor + chave separados = mais um ponto
  de falha e mais uma integração. Rejeitado pela consolidação.
- **OpenRouter + Groq Whisper.** Mais rápido/barato, sem diarização. Rejeitado — ata perde "quem falou".
- **OpenRouter + Whisper/GPT-4o Transcribe.** Sem diarização nativa. Mesmo motivo.

## Consequências

- **Positivo:** um vendor (OpenRouter) e uma chave (`OPENROUTER_API_KEY`, já usada pela ata e pelo
  oracle) cobrem transcrição + ata. Menos superfície de falha, menos secret pra gerir.
- **Forward-only:** transcrições Deepgram já existentes permanecem; só novas usam Chirp 3.
- **Contrato preservado:** a edge fn `transcribe-meeting` mantém a mesma forma de saída
  (`{ text, segments:[{speaker,text,start,end}], speakers_count, model, has_diarization }`) →
  `generate-meeting-ata` e a UI não mudam.
- **Risco a confirmar na execução:** formato exato do request de diarização e o code de idioma
  pt-BR no endpoint do OpenRouter para Chirp 3 — API recente, o engenheiro confirma na doc antes.
