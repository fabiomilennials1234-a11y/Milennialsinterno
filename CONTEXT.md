# CONTEXT — Glossário do domínio

Glossário canônico de termos do domínio. Só termos — sem detalhes de implementação.
Decisões arquiteturais vivem em `docs/adr/`. Contexto de sistema vive em `docs/wiki/`.

---

## Gravação — termo sobrecarregado, desambiguado

A palavra "gravação" significa **duas coisas distintas** neste sistema. Sempre use o termo canônico.

### Reunião Gravada (`recorded_meetings`)
Captura de tela/áudio de uma reunião, demo ou apresentação ao vivo, feita **dentro do CRM** pelo
próprio usuário. Vive em `recorded_meetings` + `meeting_folders`. Tem transcrição (Deepgram) e,
quando documentada, `ata` + `summary`. Esta é a feature do recorder in-app.

- **NÃO confundir** com a gravação de conteúdo abaixo.
- Termo curto aceitável: "reunião gravada". Evite só "gravação" sem qualificador.

### Gravação de Conteúdo (pool de gravação / atrizes de gravação)
Produção de vídeo de conteúdo para clientes — atrizes gravam material que vai pro Drive do cliente.
Vive no Kanban de Atrizes. Domínio totalmente separado de reuniões.

- Termo canônico: "gravação de conteúdo" ou "pool de gravação".

---

## Reunião Gravada — estados e termos relacionados

- **Sessão de gravação** (`recording_sessions`): estado vivo enquanto grava — máquina de estados
  `recording → stopped → assembling → done | failed | abandoned`. Efêmera; vira `recorded_meetings` ao finalizar.
- **Chunk**: pedaço de ~1s de vídeo/áudio emitido pelo MediaRecorder durante a captura.
- **Transcrição** (`transcript`): texto + segmentos por locutor (diarização), gerado pelo Deepgram.
- **Ata** (`ata`): documentação estruturada da reunião — resumo, decisões, próximos passos.
  Hoje vazia; alvo de geração automática via LLM (a "documentação automática estilo Notion").
- **Overlay flutuante**: janela always-on-top (via Document Picture-in-Picture) que mostra
  timer, status e controles sobre qualquer app durante a gravação.
