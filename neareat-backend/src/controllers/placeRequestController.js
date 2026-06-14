'use strict';

// Mekan talepleri: kullanıcıların eksik/yeni mekanları sisteme bildirmesi ve
// adminlerin bu talepleri listeleyip incelemesi (PENDING -> REVIEWED akışı).

const prisma = require('../utils/prisma');
const { logRequest } = require('../services/logService');

// Admin listelerinde talebi açan kullanıcıyı da içeren ortak select.
const REQUEST_SELECT = {
  id: true, placeId: true, placeName: true, placeAddress: true,
  note: true, status: true, createdAt: true,
  user: { select: { id: true, displayName: true, email: true } },
};

// Kullanıcı yeni bir mekan talebi oluşturur.
async function submitRequest(req, res, next) {
  try {
    const { placeId, placeName, placeAddress, note } = req.body;
    if (!placeId || !placeName) {
      return res.status(400).json({ error: 'placeId ve placeName zorunludur.' });
    }
    if (note && note.length > 500) {
      return res.status(400).json({ error: 'Not en fazla 500 karakter olabilir.' });
    }

    // Aynı kullanıcı + mekan için mükerrer talebi engelle (unique kısıt karşılığı).
    const existing = await prisma.placeRequest.findUnique({
      where: { userId_placeId: { userId: req.user.id, placeId } },
    });
    if (existing) {
      return res.status(409).json({ error: 'Bu mekan için zaten bir talebiniz bulunuyor.' });
    }

    const request = await prisma.placeRequest.create({
      data: {
        userId: req.user.id,
        placeId,
        placeName,
        placeAddress: placeAddress || null,
        note: note || null,
        status: 'PENDING',
      },
      select: REQUEST_SELECT,
    });

    // Aktivite logu fire-and-forget — talep oluşturmayı bloklamasın.
    logRequest({ req, page: 'Mekan Talepleri', action: 'Mekan talebi oluşturdu', details: placeName }).catch(() => {});
    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
}

// Kullanıcının kendi taleplerini (en yeni 50) döner.
async function myRequests(req, res, next) {
  try {
    const requests = await prisma.placeRequest.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, placeId: true, placeName: true, placeAddress: true, note: true, status: true, createdAt: true },
    });
    res.json(requests);
  } catch (err) {
    next(err);
  }
}

// Admin: tüm talepleri 20'şerlik sayfalarla, opsiyonel status filtresiyle listeler.
async function listRequests(req, res, next) {
  try {
    const { status, page = '1' } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const where = status ? { status } : {};

    const [requests, total] = await Promise.all([
      prisma.placeRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * 20,
        take: 20,
        select: REQUEST_SELECT,
      }),
      prisma.placeRequest.count({ where }),
    ]);

    res.json({ requests, total, page: pageNum, pages: Math.ceil(total / 20) });
  } catch (err) {
    next(err);
  }
}

// Admin: bir talebi "incelendi" (REVIEWED) olarak işaretler.
async function reviewRequest(req, res, next) {
  try {
    const { id } = req.params;
    const request = await prisma.placeRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ error: 'Talep bulunamadı.' });

    const updated = await prisma.placeRequest.update({
      where: { id },
      data: { status: 'REVIEWED' },
      select: REQUEST_SELECT,
    });
    logRequest({ req, page: 'Admin', action: 'Mekan talebini inceledi', details: updated.placeName }).catch(() => {});
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = { submitRequest, myRequests, listRequests, reviewRequest };
