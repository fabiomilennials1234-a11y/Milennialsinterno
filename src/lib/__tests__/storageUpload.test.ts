import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the options tus.Upload was constructed with so we can drive onBeforeRequest.
const uploadCtorCalls: { options: Record<string, unknown> }[] = [];

vi.mock('tus-js-client', () => {
  class Upload {
    options: Record<string, unknown>;
    constructor(_file: Blob, options: Record<string, unknown>) {
      this.options = options;
      uploadCtorCalls.push({ options });
    }
    findPreviousUploads() {
      return Promise.resolve([]);
    }
    resumeFromPreviousUpload() {}
    start() {
      // Simulate a successful upload completing immediately.
      (this.options.onSuccess as () => void)?.();
    }
  }
  return { Upload };
});

// Mock supabase auth: getSession returns a DIFFERENT token each call, so we can
// prove onBeforeRequest reads a fresh session per request (not a captured one).
let sessionCallCount = 0;
const getSessionMock = vi.fn(async () => {
  sessionCallCount += 1;
  return { data: { session: { access_token: `token-${sessionCallCount}` } } };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: () => getSessionMock() },
    storage: {
      from: () => ({
        upload: vi.fn(async () => ({ error: null })),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/file.webm' } }),
      }),
    },
  },
}));

import { uploadBlob, TUS_THRESHOLD } from '../storageUpload';

interface FakeHttpRequest {
  headers: Record<string, string>;
  setHeader(name: string, value: string): void;
}

function makeReq(): FakeHttpRequest {
  return {
    headers: {},
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
}

beforeEach(() => {
  uploadCtorCalls.length = 0;
  sessionCallCount = 0;
  getSessionMock.mockClear();
});

describe('uploadBlob TUS token refresh', () => {
  it('does NOT bake a static Authorization header into the TUS upload', async () => {
    const bigBlob = new Blob([new Uint8Array(TUS_THRESHOLD + 1)], { type: 'video/webm' });
    await uploadBlob('recorded-meetings', 'u/1-video.webm', bigBlob, 'video/webm');

    const opts = uploadCtorCalls[0].options;
    const headers = opts.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
    expect(typeof opts.onBeforeRequest).toBe('function');
  });

  it('fetches a FRESH session token on every request via onBeforeRequest', async () => {
    const bigBlob = new Blob([new Uint8Array(TUS_THRESHOLD + 1)], { type: 'video/webm' });
    await uploadBlob('recorded-meetings', 'u/1-video.webm', bigBlob, 'video/webm');

    const onBeforeRequest = uploadCtorCalls[0].options.onBeforeRequest as (
      req: FakeHttpRequest,
    ) => Promise<void>;

    // Simulate two sequential requests (e.g. create + a later PATCH after the
    // original token would have expired). Each must get a fresh token.
    const req1 = makeReq();
    await onBeforeRequest(req1);
    const req2 = makeReq();
    await onBeforeRequest(req2);

    expect(req1.headers.authorization).toBe('Bearer token-1');
    expect(req2.headers.authorization).toBe('Bearer token-2');
    expect(getSessionMock).toHaveBeenCalledTimes(2);
  });

  it('throws a clear error if the session is gone at request time', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } });
    const bigBlob = new Blob([new Uint8Array(TUS_THRESHOLD + 1)], { type: 'video/webm' });
    await uploadBlob('recorded-meetings', 'u/1-video.webm', bigBlob, 'video/webm');

    const onBeforeRequest = uploadCtorCalls[0].options.onBeforeRequest as (
      req: FakeHttpRequest,
    ) => Promise<void>;

    await expect(onBeforeRequest(makeReq())).rejects.toThrow(/Sessao expirada/);
  });

  it('does not use TUS for small blobs (single PUT path)', async () => {
    const smallBlob = new Blob([new Uint8Array(1024)], { type: 'image/png' });
    await uploadBlob('card-attachments', 'small.png', smallBlob, 'image/png');
    expect(uploadCtorCalls.length).toBe(0);
  });
});
