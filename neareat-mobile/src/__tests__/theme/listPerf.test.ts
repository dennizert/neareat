import { listPerf } from '../../theme/listPerf';

describe('listPerf (S14-M4)', () => {
  it('makul render-batch sınırları sağlar', () => {
    expect(listPerf.initialNumToRender).toBeGreaterThan(0);
    expect(listPerf.maxToRenderPerBatch).toBeGreaterThan(0);
    expect(listPerf.windowSize).toBeGreaterThan(0);
    expect(typeof listPerf.removeClippedSubviews).toBe('boolean');
  });
});
