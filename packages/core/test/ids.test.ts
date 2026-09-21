import { describe, expect, it } from 'vitest';
import { isUuidv7, uuidv7, uuidv7Timestamp } from '../src/ids.js';

describe('uuidv7', () => {
  it('produces well-formed v7 ids', () => {
    for (let i = 0; i < 200; i += 1) expect(isUuidv7(uuidv7())).toBe(true);
  });

  it('is time-ordered, so sync has a natural sort', () => {
    const early = uuidv7(1_700_000_000_000);
    const late = uuidv7(1_700_000_001_000);
    expect(early < late).toBe(true);
  });

  it('round-trips its timestamp', () => {
    const now = 1_762_000_000_000;
    expect(uuidv7Timestamp(uuidv7(now))).toBe(now);
  });

  it('does not collide across a burst', () => {
    const ids = new Set(Array.from({ length: 5_000 }, () => uuidv7()));
    expect(ids.size).toBe(5_000);
  });

  it('rejects other uuid versions', () => {
    expect(isUuidv7('00000000-0000-4000-8000-000000000000')).toBe(false);
  });
});
