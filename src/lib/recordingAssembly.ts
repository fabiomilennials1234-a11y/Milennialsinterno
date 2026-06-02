/**
 * Pure helpers for assembling recording chunks into a final WebM container.
 *
 * Background (issue #73, ADR 0001): `MediaRecorder.start(timeslice)` emits a
 * single continuous stream split across chunks. Chunk 0 carries the EBML
 * header; every later chunk is raw continuation of the SAME stream. The only
 * correct way to rebuild the file is to concatenate chunks in strict index
 * order with chunk 0 first. A missing chunk 0, a hole in the sequence, or a
 * generic MIME (`audio/webm` with no codecs) all produce a container that
 * decoders and STT providers reject as "corrupt data".
 *
 * These functions are intentionally pure (no Storage, no Supabase) so the
 * container invariants can be tested directly. The hook composes them.
 */

/** WebM/Matroska EBML magic — the first 4 bytes of any valid container. */
export const EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3] as const;

export interface TrackChunk {
  index: number;
  blob: Blob;
}

/** Thrown when chunk assembly cannot produce a valid container. */
export class AssemblyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssemblyError';
  }
}

/**
 * Assemble track chunks into a single blob.
 *
 * Sorts by numeric index (fetch arrival order is not trusted), then asserts the
 * index set is exactly 0..n-1 before concatenating. Tags the result with the
 * recorder's real `mimeType` (carrying codecs) — never a generic fallback.
 *
 * @throws AssemblyError if empty, if index 0 (the header carrier) is absent, or
 *         if the index set has a hole.
 */
export function assembleTrackBlob(chunks: TrackChunk[], mimeType: string): Blob {
  if (chunks.length === 0) {
    throw new AssemblyError('Nenhum chunk para montar o arquivo.');
  }

  const sorted = [...chunks].sort((a, b) => a.index - b.index);

  if (sorted[0].index !== 0) {
    throw new AssemblyError(
      `Chunk índice 0 (que carrega o header do container) ausente — começa em ${sorted[0].index}.`,
    );
  }

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].index !== i) {
      throw new AssemblyError(
        `Chunks não contíguos: faltando índice ${i} (encontrado ${sorted[i].index}).`,
      );
    }
  }

  return new Blob(sorted.map((c) => c.blob), { type: mimeType });
}

/** First byte of the Storage JSON error body `{"statusCode":...}` — `{` = 0x7b. */
const JSON_OPEN_BRACE = 0x7b;

/**
 * Screen a single fetched chunk before it enters assembly.
 *
 * `assertEbmlMagic` only inspects the assembled container's first 4 bytes, so a
 * Storage error body (`{"statusCode":"404"}`) fetched as a NON-first chunk would
 * ride inside the final audio undetected (issue #74). This rejects any chunk
 * that is empty or begins with `{` (a JSON error body, never valid WebM —
 * neither the EBML header `0x1A` nor a raw Matroska continuation byte is `{`).
 *
 * @throws AssemblyError if the chunk is empty or looks like a JSON error body.
 */
export async function assertNotErrorBody(
  blob: Blob,
  track: 'video' | 'audio',
  index: number,
): Promise<void> {
  if (blob.size === 0) {
    throw new AssemblyError(`Chunk ${track}/${index} vazio (0 bytes) — objeto ausente no Storage.`);
  }

  const first = new Uint8Array(await blob.slice(0, 1).arrayBuffer());
  if (first[0] === JSON_OPEN_BRACE) {
    throw new AssemblyError(
      `Chunk ${track}/${index} é um corpo de erro JSON (404), não áudio — abortando para não persistir lixo.`,
    );
  }
}

/**
 * Assert the assembled blob begins with the EBML magic bytes.
 *
 * Last line of defence before upload: catches both a truncated/empty container
 * and the real-world failure where a Storage JSON error body
 * (`{"statusCode":"404"...}`) was saved in place of the audio object.
 *
 * @throws AssemblyError if the blob is shorter than the magic or the bytes differ.
 */
export async function assertEbmlMagic(blob: Blob): Promise<void> {
  const header = new Uint8Array(await blob.slice(0, EBML_MAGIC.length).arrayBuffer());

  if (header.length < EBML_MAGIC.length) {
    throw new AssemblyError(
      `Container inválido: ${header.length} bytes, esperado pelo menos ${EBML_MAGIC.length} (magic EBML).`,
    );
  }

  for (let i = 0; i < EBML_MAGIC.length; i++) {
    if (header[i] !== EBML_MAGIC[i]) {
      throw new AssemblyError(
        'Container inválido: bytes iniciais não correspondem ao magic EBML (0x1A45DFA3).',
      );
    }
  }
}
