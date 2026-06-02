# 0001 — Reunião Gravada: captura no browser com overlay via Document Picture-in-Picture

- **Status:** Aceito
- **Data:** 2026-06-02
- **Decisores:** Fundador/CTO

## Contexto

O recorder in-app de reuniões (`recorded_meetings`) já existe (~80%): captura via
`getDisplayMedia` + `MediaRecorder`, chunks em IndexedDB → Supabase Storage, assemble,
transcrição Deepgram. Está "dando muito problema": controles somem ao trocar de app,
gravações somem/não salvam, transcrição trava, erros silenciosos.

O objetivo é experiência estilo Notion — overlay flutuante visível **independente de onde
o usuário esteja na tela**, gravação confiável, documentação automática — para **parar de
usar a gravação do Google Meet e do Notion**.

Caso de uso predominante (definido com o fundador): **captura de tela local** — demos e
apresentações ao vivo, com o usuário operando a própria máquina e o CRM aberto. **Não** são
chamadas online onde um bot poderia entrar na call.

## Decisão

1. **Continuar com captura no browser** (`getDisplayMedia` + `MediaRecorder`), não construir
   app nativo (Electron/Tauri) nem bot de servidor (Recall.ai).
2. **Overlay flutuante via Document Picture-in-Picture API**: janela always-on-top que flutua
   sobre qualquer aplicativo (não só sobre a aba do browser), mostrando timer, status, erros e
   controles de pause/stop.
3. **Manter e endurecer** o pipeline existente (chunk → IDB → Storage → assemble → Deepgram) em
   vez de reescrever. Diagnosticar a perda de dado antes de decidir reescrita de qualquer parte.
4. **Adicionar pipeline de documentação automática** (ata via LLM) após a transcrição.

## Alternativas consideradas

- **App nativo (Electron/Tauri), paridade literal com Notion.** Dá overlay OS-level e
  sobrevivência ao browser fechado, mas exige um canal de distribuição inteiro: build, assinatura,
  auto-update, e forçar o time a instalar. Rejeitado — ganho ~10% para um caso (browser fechado)
  que não ocorre em demos/apresentações com o CRM aberto.
- **Bot de servidor (Recall.ai / estilo Fathom).** Excelente para chamadas Meet/Zoom, grava no
  servidor sem overlay no PC. Rejeitado — caso de uso é tela local, não chamada online.
- **Extensão de browser.** Não desenha overlay OS-level sobre apps nativos; cobre só conteúdo do
  browser. Não resolve o requisito de flutuar sobre Keynote/Figma/etc.

## Consequências

- **Positivo:** overlay flutua sobre qualquer app sem instalar nada; vive dentro do CRM já
  distribuído; reaproveita 80% do pipeline; sem novo canal de distribuição.
- **Negativo / limite aceito:** se o usuário fechar o **navegador inteiro** durante a gravação,
  a sessão para (mitigado por recovery via IDB). Document PiP exige Chromium (Chrome/Edge) —
  Firefox/Safari não suportam; aceitável para uso interno padronizado em Chrome.
- **Risco a tratar:** a bug de "gravação some / não salva" precisa de diagnóstico real
  (reproduzir → minimizar) antes do hardening — pode revelar falha no caminho de upload
  (refresh de token mid-upload) ou na edge function fire-and-forget que morre no close do browser.

### Emenda 2026-06-02 — diagnóstico do container WebM inválido (issue #73)

Diagnóstico real via `ffprobe`/`ffmpeg` sobre áudios do bucket `recorded-meetings`
(service role). Classificação A/B/C:

- **Classificação = B** (header presente, finalização ausente). No áudio longo real
  (`1216s`, ~9.4MB) o header EBML **está presente** (`1A45DFA3`); o elemento `Segment`
  carrega **size desconhecido/streaming** (`0x01FFFFFFFFFFFFFF`) e `Duration` nunca é
  finalizado → `ffprobe` reporta `Duration: N/A`. **Não é A** (header não está ausente)
  e **não é C** (a concatenação por índice reproduz o arquivo byte-a-byte e decodifica
  os 20:16 completos — ordem está correta).
- **Causa do sintoma histórico:** as duas únicas transcrições `failed` são pré-migração
  OpenRouter (Deepgram, `"corrupt or unsupported data"`, `duration=null`) — assinatura
  exata de B. Somava-se a isso o blob final montado com MIME genérico `audio/webm`
  (sem codecs) em vez do MIME real do recorder.
- **Achado lateral (fora do escopo #73):** gravações curtas (4s/9s/2s) têm o objeto de
  áudio final **ausente no Storage** — o `*.webm` retorna `{"statusCode":"404"}` (69 bytes)
  salvo no lugar do áudio. Bug do caminho de upload do arquivo final, **não** de container.
  Escalado ao arquiteto separadamente.

**Correção (issue #73, client-side, sem remux pesado):** em `src/lib/recordingAssembly.ts`
+ `useRecordingAssembly.ts` — (1) MIME real do recorder (com codecs) no blob final;
(2) validação de presença+contiguidade do chunk índice 0 antes de concatenar;
(3) assert do magic EBML no container montado antes do upload.

**Fronteira do fallback server-side (item 4, NÃO construído):** o remux cirúrgico do
áudio (reescrever `Duration`/`Segment` size via ffmpeg, ≤25MB) só entra **sob evidência
de que B persiste no STT após (1-3)**. Hoje não há essa evidência: todas as transcrições
pós-migração Groq/Whisper estão `completed`, e o decoder lê o áudio N/A-duration por
inteiro. Construir agora seria especulativo. Boundary marcada; reabrir se surgir um
`transcript_error` de container no STT atual.
