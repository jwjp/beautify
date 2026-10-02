import { describe, expect, it } from 'vitest';
import { formatFromFilename, formatSource, samples } from './formatter';

describe('formatSource', () => {
  it('formats and validates JSON without changing values', async () => {
    const result = await formatSource('{"nested":{"value":true},"list":[1,2]}', 'json', 4);
    expect(result).toContain('\n    "nested"');
    expect(JSON.parse(result)).toEqual({ nested: { value: true }, list: [1, 2] });
    await expect(formatSource('{"broken":}', 'json', 2)).rejects.toThrow();
  });

  it.each(['yaml', 'xml', 'html', 'css', 'javascript', 'sql', 'markdown'] as const)(
    'formats %s sample content', async (format) => {
      const result = await formatSource(samples[format], format, 2);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('\n');
    },
  );

  it('rejects malformed XML', async () => {
    await expect(formatSource('<root><child></root>', 'xml', 2)).rejects.toThrow();
  });

  it('treats whitespace-only input as empty', async () => {
    expect(await formatSource('  \n ', 'json', 2)).toBe('');
  });
});

describe('formatFromFilename', () => {
  it('recognizes common extensions without case sensitivity', () => {
    expect(formatFromFilename('config.YML')).toBe('yaml');
    expect(formatFromFilename('page.HTM')).toBe('html');
    expect(formatFromFilename('query.sql')).toBe('sql');
    expect(formatFromFilename('notes.txt')).toBeNull();
  });
});
