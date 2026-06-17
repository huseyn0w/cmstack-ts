import { describe, expect, it } from 'vitest';
import { extensionForMime } from './media.service';

describe('extensionForMime', () => {
  it('maps each allowed MIME type to a safe extension', () => {
    expect(extensionForMime('image/jpeg')).toBe('.jpg');
    expect(extensionForMime('image/png')).toBe('.png');
    expect(extensionForMime('image/gif')).toBe('.gif');
    expect(extensionForMime('image/webp')).toBe('.webp');
    expect(extensionForMime('application/pdf')).toBe('.pdf');
  });

  it('never derives a dangerous extension from an unknown/forged MIME type', () => {
    // A polyglot attack relies on getting a .html (or similar) extension; the
    // map returns empty for anything not explicitly allowed.
    expect(extensionForMime('text/html')).toBe('');
    expect(extensionForMime('image/svg+xml')).toBe('');
    expect(extensionForMime('application/octet-stream')).toBe('');
  });
});
