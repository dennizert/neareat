const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');

// S3 fotoğraf yükleme altyapısı (S10-2).
// Restoran/ürün fotoğrafları S3'te tutulur; DB yalnızca public URL saklar.
// Yükleme: backend presigned PUT URL üretir → istemci doğrudan S3'e yükler.
const REGION = process.env.AWS_REGION;
const BUCKET = process.env.AWS_S3_BUCKET;
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;

const ALLOWED_CONTENT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const ALLOWED_KINDS = ['restaurant', 'product'];
const PRESIGN_EXPIRES_SECONDS = 300; // 5 dk

/** S3 tam yapılandırılmış mı (4 env var da dolu)? */
function isS3Configured() {
  return !!(REGION && BUCKET && ACCESS_KEY && SECRET_KEY);
}

let _client;
function getClient() {
  if (!_client) {
    _client = new S3Client({
      region: REGION,
      credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
    });
  }
  return _client;
}

/** Nesnenin public URL'i (path-style: region'a göre virtual-hosted URL). */
function publicUrl(key) {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

/**
 * Bir foto yüklemesi için presigned PUT URL + nihai public URL üretir.
 * @param {string} profileId restoran profili id (key scope)
 * @param {string} kind 'restaurant' | 'product'
 * @param {string} contentType izinli image MIME
 * @returns {Promise<{ uploadUrl, key, publicUrl, expiresIn }>}
 */
async function createUploadUrl(profileId, kind, contentType) {
  const ext = ALLOWED_CONTENT_TYPES[contentType];
  const key = `restaurants/${profileId}/${kind}/${randomUUID()}.${ext}`;
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: PRESIGN_EXPIRES_SECONDS });
  return { uploadUrl, key, publicUrl: publicUrl(key), expiresIn: PRESIGN_EXPIRES_SECONDS };
}

/** Verilen public URL'in bu bucket'a ait key'ini çıkarır (silme için); değilse null. */
function keyFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const prefix = `https://${BUCKET}.s3.${REGION}.amazonaws.com/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

/** S3'ten bir nesneyi siler (best-effort). */
async function deleteObject(key) {
  if (!key) return;
  await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Bir nesnenin boyutunu (byte) döner; bulunamazsa/erişilemezse hata fırlatır. */
async function getObjectSize(key) {
  const res = await getClient().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  return res.ContentLength ?? null;
}

module.exports = {
  isS3Configured,
  createUploadUrl,
  deleteObject,
  getObjectSize,
  keyFromUrl,
  ALLOWED_CONTENT_TYPES,
  ALLOWED_KINDS,
};
