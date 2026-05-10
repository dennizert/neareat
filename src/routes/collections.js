const router = require('express').Router();
const auth = require('../middleware/auth');
const {
  listMyCollections,
  listSharedWithMe,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  addItem,
  removeItem,
  shareWithFriend,
  unshareWithFriend,
} = require('../controllers/collectionController');

router.get('/', auth, listMyCollections);
router.get('/shared-with-me', auth, listSharedWithMe);
router.post('/', auth, createCollection);

router.get('/:id', auth, getCollection);
router.put('/:id', auth, updateCollection);
router.delete('/:id', auth, deleteCollection);

router.post('/:id/items', auth, addItem);
router.delete('/:id/items/:placeId', auth, removeItem);

router.post('/:id/share/:friendId', auth, shareWithFriend);
router.delete('/:id/share/:friendId', auth, unshareWithFriend);

module.exports = router;
