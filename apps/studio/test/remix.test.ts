import type { StoryPackage } from '@engine';
import { describe, expect, it } from 'vitest';
import { canRemix, creditLine, forExport, hashPin, isPin, remixCopy } from '../src/lib/remix';
import { loveComedy } from '../src/samples/loveComedy';

const work = (meta: Partial<StoryPackage['meta']>): StoryPackage => ({ ...structuredClone(loveComedy), meta: { ...loveComedy.meta, id: 'p_orig', ...meta } });

describe('편집 허가와 원작자 표기', () => {
  it('샘플은 늘 허가, 다른 작품은 작가가 허가했을 때만', () => {
    expect(canRemix(loveComedy)).toBe(true);
    expect(canRemix(work({}))).toBe(false);
    expect(canRemix(work({ remix: { allow: false } }))).toBe(false);
    expect(canRemix(work({ remix: { allow: true } }))).toBe(true);
  });

  it('비밀번호는 숫자 6자리까지, 해시는 작품마다 다르다', () => {
    expect(isPin('123456')).toBe(true);
    expect(isPin('1234567')).toBe(false);
    expect(isPin('12a4')).toBe(false);
    expect(isPin('')).toBe(false);
    expect(hashPin('p_a', '1234')).toBe(hashPin('p_a', '1234'));
    expect(hashPin('p_a', '1234')).not.toBe(hashPin('p_a', '1235'));
    expect(hashPin('p_a', '1234')).not.toBe(hashPin('p_b', '1234'));
    expect(hashPin('p_a', '1234')).not.toContain('1234');
  });

  it('사본을 내보내면 작가 칸이 "원작자, 복사자" 순서가 된다', () => {
    const orig = work({ author: '김원작', remix: { allow: true, pinHash: 'x' } });
    const copy = remixCopy(orig, 'p_copy', '박사본');
    expect(copy.meta.id).toBe('p_copy');
    expect(copy.meta.remix).toBeUndefined();
    expect(copy.meta.credits).toEqual(['김원작']);
    expect(forExport(copy).meta.author).toBe('김원작, 박사본');
    expect(forExport(copy).meta.credits).toBeUndefined();
    // 원본은 그대로
    expect(orig.meta.author).toBe('김원작');
    // 사본의 사본은 원작자 순서대로 이어진다
    const again = remixCopy({ ...copy, meta: { ...copy.meta, remix: { allow: true } } }, 'p_3', '최셋째');
    expect(creditLine(again.meta)).toBe('김원작, 박사본, 최셋째');
  });

  it('작품에 작가 이름이 없으면 올린 사람의 닉네임을 원작자로', () => {
    const copy = remixCopy(work({ author: undefined, remix: { allow: true } }), 'p_c', '나', '올린이');
    expect(forExport(copy).meta.author).toBe('올린이, 나');
  });

  it('사본이 아니면 내보내기 그대로', () => {
    const w = work({ author: '김원작' });
    expect(forExport(w)).toBe(w);
  });
});
