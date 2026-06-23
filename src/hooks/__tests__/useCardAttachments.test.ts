import { describe, it, expect } from 'vitest';
import {
  isAllowedFileType,
  getMaxFileSize,
  DESIGN_ASSET_EXTENSIONS,
} from '../useCardAttachments';

const TEN_MB = 10 * 1024 * 1024;

describe('isAllowedFileType', () => {
  it('allows known image MIME', () => {
    expect(isAllowedFileType('image/png', 'a.png')).toBe(true);
  });

  it('allows known video MIME', () => {
    expect(isAllowedFileType('video/mp4', 'a.mp4')).toBe(true);
  });

  it('allows documents', () => {
    expect(isAllowedFileType('application/pdf', 'a.pdf')).toBe(true);
  });

  // --- Design assets: the bug being fixed ---

  it('allows .psd when File.type is empty (extension fallback)', () => {
    expect(isAllowedFileType('', 'design.psd')).toBe(true);
  });

  it('allows .psd with the photoshop MIME', () => {
    expect(isAllowedFileType('image/vnd.adobe.photoshop', 'design.psd')).toBe(true);
  });

  it('allows .PSD uppercase (case-insensitive)', () => {
    expect(isAllowedFileType('', 'DESIGN.PSD')).toBe(true);
  });

  it('allows .ai and .eps', () => {
    expect(isAllowedFileType('', 'logo.ai')).toBe(true);
    expect(isAllowedFileType('', 'vector.eps')).toBe(true);
    expect(isAllowedFileType('application/postscript', 'vector.eps')).toBe(true);
  });

  // --- Security invariant (Decisão 3): empty MIME only passes via closed whitelist ---

  it('DENIES empty MIME with a non-whitelisted extension', () => {
    expect(isAllowedFileType('', 'malware.exe')).toBe(false);
  });

  it('DENIES empty MIME with no fileName', () => {
    expect(isAllowedFileType('')).toBe(false);
  });

  it('DENIES unrecognized MIME with non-design extension', () => {
    expect(isAllowedFileType('application/octet-stream', 'archive.zip')).toBe(false);
  });

  it('does not allow a fake .psd-in-name via substring (must be the extension)', () => {
    expect(isAllowedFileType('', 'psd.exe')).toBe(false);
    expect(isAllowedFileType('', 'notpsdreally.bin')).toBe(false);
  });

  it('exports the closed design-asset extension list', () => {
    expect(DESIGN_ASSET_EXTENSIONS).toEqual(['.psd', '.ai', '.eps']);
  });
});

describe('getMaxFileSize', () => {
  it('returns Infinity for video MIME', () => {
    expect(getMaxFileSize('video/mp4')).toBe(Infinity);
  });

  it('returns Infinity for design assets via extension (empty MIME)', () => {
    expect(getMaxFileSize('', 'design.psd')).toBe(Infinity);
    expect(getMaxFileSize('', 'LOGO.AI')).toBe(Infinity);
    expect(getMaxFileSize('', 'art.eps')).toBe(Infinity);
  });

  it('returns 10MB for pdf', () => {
    expect(getMaxFileSize('application/pdf')).toBe(TEN_MB);
  });

  it('returns 10MB for a regular image', () => {
    expect(getMaxFileSize('image/png', 'a.png')).toBe(TEN_MB);
  });

  it('returns 10MB for empty MIME without a design extension', () => {
    expect(getMaxFileSize('', 'random.txt')).toBe(TEN_MB);
  });
});
