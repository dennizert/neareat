'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const ctrl = require('../controllers/placeRequestController');

router.use(auth);

router.post('/', ctrl.submitRequest);
router.get('/my', ctrl.myRequests);

module.exports = router;
