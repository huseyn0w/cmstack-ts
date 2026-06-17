import { describe, expect, it } from 'vitest';
import { HtmlSanitizerService } from './html-sanitizer.service';

describe('HtmlSanitizerService', () => {
  const service = new HtmlSanitizerService();

  it('keeps allowed formatting tags', () => {
    const html = '<p>Hello <strong>world</strong> and <em>friends</em></p>';
    expect(service.sanitize(html)).toBe(html);
  });

  it('strips <script> tags and their content', () => {
    const out = service.sanitize('<p>ok</p><script>alert(1)</script>');
    expect(out).toBe('<p>ok</p>');
    expect(out).not.toContain('script');
  });

  it('removes inline event handlers', () => {
    const out = service.sanitize('<p onclick="steal()">click</p>');
    expect(out).toBe('<p>click</p>');
    expect(out).not.toContain('onclick');
  });

  it('blocks javascript: URLs on links', () => {
    const out = service.sanitize('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain('javascript:');
  });

  it('adds rel="noopener noreferrer nofollow" to links', () => {
    const out = service.sanitize('<a href="https://example.com">link</a>');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });

  it('drops unknown tags but keeps their text', () => {
    expect(service.sanitize('<marquee>hi</marquee>')).toBe('hi');
  });

  it('strips data: image sources (svg-script vector)', () => {
    const out = service.sanitize('<img src="data:image/svg+xml,<script>alert(1)</script>">');
    expect(out).not.toContain('data:');
    expect(out).not.toContain('script');
  });

  it('keeps http(s) image sources', () => {
    const out = service.sanitize('<img src="https://example.com/a.png" alt="a">');
    expect(out).toContain('src="https://example.com/a.png"');
  });
});
