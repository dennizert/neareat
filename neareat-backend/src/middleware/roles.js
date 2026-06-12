// Route'u yalnızca RESTAURANT rolüne açar (restoran paneli/B2B uçları). authenticate'ten sonra.
function requireRestaurant(req, res, next) {
  if (req.user.role !== 'RESTAURANT') {
    return res.status(403).json({ error: 'Restoran hesabı gerekli' });
  }
  next();
}

// Route'u yalnızca ADMIN rolüne açar (admin paneli/moderasyon uçları). authenticate'ten sonra.
function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin yetkisi gerekli' });
  }
  next();
}

module.exports = { requireRestaurant, requireAdmin };
