/**
 * Issue #73 — invalid WebM container fix.
 *
 * Diagnosis (ffprobe on real bucket audio, classification B):
 *   - EBML header IS present (0x1A45DFA3) on the long real recording.
 *   - Segment element carries an UNKNOWN/streaming size (0x01FFFFFFFFFFFFFF)
 *     and Duration is never finalized → ffprobe reports duration=N/A and STT
 *     rejects with "Bad Request" / reads zero-length audio.
 *   - The assembled blob was also tagged with the generic MIME `audio/webm`
 *     (no codecs) instead of the recorder's real `audio/webm;codecs=opus`.
 *
 * These tests pin the client-side guarantees from the signed decision:
 *   1. concatenation order follows numeric chunk index, header chunk first;
 *   2. the assembled blob declares the recorder's real MIME (with codecs);
 *   3. a missing index-0 (header carrier) fails loud, never uploads garbage;
 *   4. a non-contiguous index set fails loud, never silently concatenates;
 *   5. the assembled container's first bytes are asserted against EBML magic.
 */
import { describe, it, expect } from 'vitest';
import {
  EBML_MAGIC,
  assembleTrackBlob,
  assertEbmlMagic,
  type TrackChunk,
} from '@/lib/recordingAssembly';

// Build a webm-ish chunk: only chunk index 0 carries the EBML header,
// mirroring how MediaRecorder.start(timeslice) emits the stream.
function headerChunk(): Blob {
  return new Blob([new Uint8Array([...EBML_MAGIC, 0x9f, 0x42, 0x86])], { type: 'audio/webm' });
}
function bodyChunk(marker: number): Blob {
  return new Blob([new Uint8Array([0xa3, 0x42, marker])], { type: 'audio/webm' });
}

async function firstBytes(blob: Blob, n: number): Promise<number[]> {
  const buf = await blob.slice(0, n).arrayBuffer();
  return Array.from(new Uint8Array(buf));
}

describe('assembleTrackBlob', () => {
  it('contiguous ordered chunks → blob begins with EBML magic', async () => {
    const chunks: TrackChunk[] = [
      { index: 0, blob: headerChunk() },
      { index: 1, blob: bodyChunk(0x01) },
    ];

    const blob = assembleTrackBlob(chunks, 'audio/webm;codecs=opus');

    expect(await firstBytes(blob, 4)).toEqual([...EBML_MAGIC]);
  });

  it('declares the recorder MIME with codecs, not generic audio/webm', () => {
    const chunks: TrackChunk[] = [
      { index: 0, blob: headerChunk() },
      { index: 1, blob: bodyChunk(0x01) },
    ];

    const blob = assembleTrackBlob(chunks, 'audio/webm;codecs=opus');

    expect(blob.type).toBe('audio/webm;codecs=opus');
    expect(blob.type).not.toBe('audio/webm');
  });

  it('orders concatenation by numeric index, not array (fetch arrival) order', async () => {
    // Header chunk arrives LAST in the array — assembly must still put it first.
    const chunks: TrackChunk[] = [
      { index: 2, blob: bodyChunk(0x22) },
      { index: 1, blob: bodyChunk(0x11) },
      { index: 0, blob: headerChunk() },
    ];

    const blob = assembleTrackBlob(chunks, 'audio/webm;codecs=opus');
    const bytes = await firstBytes(blob, blob.size);

    // EBML magic first (header chunk), then body markers in index order.
    expect(bytes.slice(0, 4)).toEqual([...EBML_MAGIC]);
    expect(bytes).toContain(0x11);
    expect(bytes.indexOf(0x11)).toBeLessThan(bytes.indexOf(0x22));
  });

  it('missing index 0 (header carrier) → throws, never assembles', () => {
    const chunks: TrackChunk[] = [
      { index: 1, blob: bodyChunk(0x11) },
      { index: 2, blob: bodyChunk(0x22) },
    ];

    expect(() => assembleTrackBlob(chunks, 'audio/webm;codecs=opus')).toThrow(/índice 0|header/i);
  });

  it('non-contiguous index set (hole) → throws, never silent concat', () => {
    const chunks: TrackChunk[] = [
      { index: 0, blob: headerChunk() },
      { index: 1, blob: bodyChunk(0x11) },
      { index: 3, blob: bodyChunk(0x33) }, // index 2 missing
    ];

    expect(() => assembleTrackBlob(chunks, 'audio/webm;codecs=opus')).toThrow(/contígu|faltando|2/i);
  });

  it('empty chunk set → throws, never produces a 0-byte container', () => {
    expect(() => assembleTrackBlob([], 'audio/webm;codecs=opus')).toThrow();
  });
});

describe('assertEbmlMagic', () => {
  it('passes when the container starts with EBML magic', async () => {
    const blob = new Blob([new Uint8Array([...EBML_MAGIC, 0x00, 0x01])], { type: 'audio/webm' });
    await expect(assertEbmlMagic(blob)).resolves.toBeUndefined();
  });

  it('throws when the first bytes are not EBML (e.g. a JSON error body)', async () => {
    // Real failure mode seen in the bucket: a `{"statusCode":"404"...}` body
    // saved as the audio object. Magic bytes are `7b 22 73 74` = `{"st`.
    const jsonBody = new Blob([new TextEncoder().encode('{"statusCode":"404"}')], { type: 'audio/webm' });
    await expect(assertEbmlMagic(jsonBody)).rejects.toThrow(/EBML|container/i);
  });

  it('throws on a blob shorter than the 4-byte magic', async () => {
    const tiny = new Blob([new Uint8Array([0x1a, 0x45])], { type: 'audio/webm' });
    await expect(assertEbmlMagic(tiny)).rejects.toThrow();
  });
});
