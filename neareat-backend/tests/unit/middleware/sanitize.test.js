'use strict';

const sanitize = require('../../../src/middleware/sanitize');

/**
 * Helper: runs the sanitize middleware synchronously and returns the
 * (possibly mutated) req object and the jest next mock.
 */
function run(body) {
  const req = { body };
  const res = {};
  const next = jest.fn();
  sanitize(req, res, next);
  return { req, next };
}

describe('sanitize middleware — string cleaning', () => {
  it('strips <script> tags from string values', () => {
    // The regex removes tag delimiters only; inner text between tags remains.
    // <script>alert(1)</script>hello → "alert(1)hello"
    const { req } = run({ name: '<script>alert(1)</script>hello' });
    expect(req.body.name).toBe('alert(1)hello');
  });

  it('strips <img> tags from string values', () => {
    // Self-closing / open tags with attributes are removed; adjacent text remains.
    const { req } = run({ text: '<img src="x" onerror="evil()">caption' });
    expect(req.body.text).toBe('caption');
  });

  it('strips any arbitrary HTML tag — tag delimiters removed, inner text preserved', () => {
    // <b>bold</b> → "bold", <i>italic</i> → "italic"
    const { req } = run({ content: '<b>bold</b> and <i>italic</i>' });
    expect(req.body.content).toBe('bold and italic');
  });

  it('trims leading and trailing whitespace from strings', () => {
    const { req } = run({ value: '  hello world  ' });
    expect(req.body.value).toBe('hello world');
  });

  it('strips tags AND trims whitespace together', () => {
    const { req } = run({ value: '  <b>hi</b>  ' });
    expect(req.body.value).toBe('hi');
  });

  it('turns a string containing only whitespace into an empty string', () => {
    const { req } = run({ value: '   ' });
    expect(req.body.value).toBe('');
  });

  it('leaves an already-empty string as an empty string', () => {
    const { req } = run({ value: '' });
    expect(req.body.value).toBe('');
  });
});

describe('sanitize middleware — nested objects and arrays', () => {
  it('sanitizes strings inside nested objects', () => {
    const { req } = run({ outer: { inner: '<div>clean me</div>' } });
    expect(req.body.outer.inner).toBe('clean me');
  });

  it('sanitizes strings inside arrays', () => {
    const { req } = run({ list: ['<b>one</b>', '<i>two</i>', 'three'] });
    expect(req.body.list).toEqual(['one', 'two', 'three']);
  });

  it('sanitizes arrays inside objects', () => {
    const { req } = run({ wrapper: { items: ['<em>a</em>', 'b'] } });
    expect(req.body.wrapper.items).toEqual(['a', 'b']);
  });

  it('handles deeply nested structures — tag delimiters stripped, inner text preserved', () => {
    // '<script>x</script>deep' → tag brackets removed → 'xdeep'
    const { req } = run({ a: { b: { c: '<script>x</script>deep' } } });
    expect(req.body.a.b.c).toBe('xdeep');
  });
});

describe('sanitize middleware — prototype pollution protection', () => {
  it('removes the __proto__ key from the body', () => {
    const body = Object.create(null);
    body.__proto__ = { polluted: true };   // plain key, not actual proto mutation
    body.safe = 'value';
    const { req } = run(body);
    expect(Object.prototype.hasOwnProperty.call(req.body, '__proto__')).toBe(false);
    expect(req.body.safe).toBe('value');
  });

  it('removes the constructor key from the body', () => {
    const { req } = run({ constructor: 'evil', name: 'ok' });
    expect(Object.prototype.hasOwnProperty.call(req.body, 'constructor')).toBe(false);
    expect(req.body.name).toBe('ok');
  });

  it('removes the prototype key from the body', () => {
    const { req } = run({ prototype: { bad: true }, name: 'safe' });
    expect(Object.prototype.hasOwnProperty.call(req.body, 'prototype')).toBe(false);
    expect(req.body.name).toBe('safe');
  });
});

describe('sanitize middleware — non-string value pass-through', () => {
  it('passes numbers through unchanged', () => {
    const { req } = run({ count: 42 });
    expect(req.body.count).toBe(42);
  });

  it('passes booleans through unchanged', () => {
    const { req } = run({ active: true });
    expect(req.body.active).toBe(true);
  });

  it('passes null values through unchanged', () => {
    const { req } = run({ nothing: null });
    expect(req.body.nothing).toBeNull();
  });
});

describe('sanitize middleware — edge cases for req.body', () => {
  it('does not crash when req.body is null', () => {
    expect(() => run(null)).not.toThrow();
  });

  it('does not crash when req.body is a string', () => {
    expect(() => run('raw string')).not.toThrow();
  });

  it('does not crash when req.body is a number', () => {
    expect(() => run(123)).not.toThrow();
  });

  it('does not crash when req.body is undefined', () => {
    expect(() => run(undefined)).not.toThrow();
  });
});

describe('sanitize middleware — next() and immutability', () => {
  it('calls next() after sanitizing', () => {
    const { next } = run({ x: '<b>hi</b>' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() even when body is null', () => {
    const { next } = run(null);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not mutate the original array in-place — returns a new cleaned array', () => {
    const originalArray = ['<b>one</b>', 'two'];
    const bodyCopy = { list: originalArray };
    const { req } = run(bodyCopy);
    // The returned array is a new object
    expect(req.body.list).not.toBe(originalArray);
    expect(req.body.list).toEqual(['one', 'two']);
    // Original array is unchanged
    expect(originalArray[0]).toBe('<b>one</b>');
  });

  it('only cleans dirty values — leaves clean values untouched', () => {
    // Tag delimiters stripped; inner text 'x' remains → 'xbad'
    const { req } = run({ dirty: '<script>x</script>bad', clean: 'good' });
    expect(req.body.dirty).toBe('xbad');
    expect(req.body.clean).toBe('good');
  });
});
