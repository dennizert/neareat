'use strict';

/**
 * #487 — s3.js `keyFromUrl` daha önce hiç test edilmemişti. Bir public URL'in
 * DOĞRU bucket'a ait olup olmadığını doğrulayıp S3 key'ini çıkaran, silme
 * işleminden ÖNCE çağrılan güvenlik-ilişkili kontrol (restaurantAccountService,
 * authController hesap-silme akışında kullanılıyor).
 */

process.env.AWS_REGION = 'eu-west-1';
process.env.AWS_S3_BUCKET = 'neareat-test-bucket';
process.env.AWS_ACCESS_KEY_ID = 'test-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';

const { keyFromUrl } = require('../../../src/services/s3');

describe('keyFromUrl', () => {
  it('doğru bucket prefix’iyle başlayan URL’den key’i doğru çıkarır', () => {
    const url = 'https://neareat-test-bucket.s3.eu-west-1.amazonaws.com/restaurants/p1/restaurant/abc.jpg';
    expect(keyFromUrl(url)).toBe('restaurants/p1/restaurant/abc.jpg');
  });

  it('farklı bir bucket’a ait URL için null döner', () => {
    const url = 'https://other-bucket.s3.eu-west-1.amazonaws.com/restaurants/p1/restaurant/abc.jpg';
    expect(keyFromUrl(url)).toBeNull();
  });

  it('farklı bir region’a ait (aynı bucket adlı) URL için null döner', () => {
    const url = 'https://neareat-test-bucket.s3.us-east-1.amazonaws.com/x.jpg';
    expect(keyFromUrl(url)).toBeNull();
  });

  it('tamamen alakasız bir domain için null döner', () => {
    expect(keyFromUrl('https://evil.com/neareat-test-bucket.s3.eu-west-1.amazonaws.com/x.jpg')).toBeNull();
  });

  it('boş string için null döner', () => {
    expect(keyFromUrl('')).toBeNull();
  });

  it('undefined/null girdi için null döner', () => {
    expect(keyFromUrl(undefined)).toBeNull();
    expect(keyFromUrl(null)).toBeNull();
  });

  it('string olmayan girdi için null döner', () => {
    expect(keyFromUrl(123)).toBeNull();
    expect(keyFromUrl({})).toBeNull();
  });
});
