'use strict';

const { containsOffensiveContent } = require('../../../src/utils/contentFilter');

describe('containsOffensiveContent', () => {
  describe('clean / edge-case inputs', () => {
    it('returns false for clean Turkish text', () => {
      expect(containsOffensiveContent('Harika bir yer!')).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(containsOffensiveContent('')).toBe(false);
    });

    it('returns false for null', () => {
      expect(containsOffensiveContent(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(containsOffensiveContent(undefined)).toBe(false);
    });

    it('returns false for a number input', () => {
      expect(containsOffensiveContent(42)).toBe(false);
    });

    it('returns false for a long clean restaurant review', () => {
      const review = 'Bu restoran gerçekten muhteşemdi. Yemekler tazeydi, servis hızlıydı ve atmosfer çok güzeldi. Kesinlikle tekrar geleceğim.';
      expect(containsOffensiveContent(review)).toBe(false);
    });
  });

  describe('Turkish offensive words', () => {
    it('detects direct offensive word "siktir"', () => {
      expect(containsOffensiveContent('siktir')).toBe(true);
    });

    it('detects offensive word inside a clean sentence', () => {
      expect(containsOffensiveContent('Bu yemek çok siktir olmuş')).toBe(true);
    });

    it('detects "salak"', () => {
      expect(containsOffensiveContent('salak')).toBe(true);
    });
  });

  describe('English offensive words', () => {
    it('detects direct offensive word "fuck"', () => {
      expect(containsOffensiveContent('fuck')).toBe(true);
    });

    it('detects uppercase "FUCK"', () => {
      expect(containsOffensiveContent('FUCK')).toBe(true);
    });

    it('detects mixed-case "FuCk"', () => {
      expect(containsOffensiveContent('FuCk')).toBe(true);
    });

    it('detects "bastard"', () => {
      expect(containsOffensiveContent('bastard')).toBe(true);
    });

    it('detects punctuation-separated "fuck!"', () => {
      expect(containsOffensiveContent('fuck!')).toBe(true);
    });
  });

  describe('offensive phrases', () => {
    it('detects phrase "orospu çocuğu"', () => {
      expect(containsOffensiveContent('orospu çocuğu')).toBe(true);
    });

    it('detects phrase "siktir git"', () => {
      expect(containsOffensiveContent('siktir git')).toBe(true);
    });
  });

  describe('normalization / bypass attempts', () => {
    it('detects leetspeak "s1kt1r" (1 → i normalization)', () => {
      expect(containsOffensiveContent('s1kt1r')).toBe(true);
    });

    it('does not detect "f*ck" because asterisk removal yields "fck" which does not match "fuck"', () => {
      expect(containsOffensiveContent('f*ck')).toBe(false);
    });

    it('detects Turkish suffix "siktirsin" (starts with "siktir" + 3 chars)', () => {
      expect(containsOffensiveContent('siktirsin')).toBe(true);
    });

    it('uzatılmış yazımı yakalar: "siktiiir"', () => {
      expect(containsOffensiveContent('siktiiir')).toBe(true);
    });

    it('uzatılmış İngilizce yazımı yakalar: "fuuuck"', () => {
      expect(containsOffensiveContent('fuuuck')).toBe(true);
    });

    it('leetspeak ifadeyi yakalar: "s1ktir git" (ifade metni de normalize edilir)', () => {
      expect(containsOffensiveContent('s1ktir git')).toBe(true);
    });

    it('temiz uzun yazımda yanlış pozitif yok: "çoook güzeldi"', () => {
      expect(containsOffensiveContent('çoook güzeldi')).toBe(false);
    });
  });
});
