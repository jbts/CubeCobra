import { arraysEqual, arrayShuffle } from 'utils/Util';

describe('arraysEqual', () => {
  it('returns true when the arguments are the same', () => {
    const a = [1, 2, 3];
    expect(arraysEqual(a, a)).toBe(true);
  });

  it('returns true on equal arrays', () => {
    const a = [':)'];
    const b = [':)'];
    expect(arraysEqual(a, b)).toBe(true);
    expect(arraysEqual([], [])).toBe(true);
  });

  it('returns false on arrays of different lengths', () => {
    const a = ['a', 'b'];
    const b = ['a', 'b', 'c'];
    expect(arraysEqual(a, b)).toBe(false);
    expect(arraysEqual(b, a)).toBe(false);
  });

  it('returns false on unequal arrays', () => {
    const a = [1, 1, 2, 3, 5];
    const b = [1, 3, 4, 7, 11];
    expect(arraysEqual(a, b)).toBe(false);
    expect(arraysEqual(b, a)).toBe(false);
  });

  it('returns false if an argument is not an array', () => {
    const a = 1;
    const b = [];
    expect(arraysEqual(a, b)).toBe(false);
    expect(arraysEqual(b, a)).toBe(false);
  });
});

describe('arrayShuffle', () => {
  it('returns an array of the same length', () => {
    const a = [];
    const b = ['x'];
    const c = [3, 1, 4, 1, 5, 9];
    expect(arrayShuffle(a)).toHaveLength(a.length);
    expect(arrayShuffle(b)).toHaveLength(b.length);
    expect(arrayShuffle(c)).toHaveLength(c.length);
  });
});
