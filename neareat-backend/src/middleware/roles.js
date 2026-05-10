function requireRestaurant(req, res, next) {
  if (req.user.role !== 'RESTAURANT') {
    return res.status(403).json({ error: 'Restoran hesabı gerekli' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin yetkisi gerekli' });
  }
  next();
}

module.exports = { requireRestaurant, requireAdmin };
