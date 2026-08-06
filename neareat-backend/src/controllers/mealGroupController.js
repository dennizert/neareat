/**
 * Yemek grupları uçları — İNCE controller (S23-2).
 *
 * S22-1 konvansiyonu: yalnızca HTTP çevirisi. Grup/anket iş kuralları
 * `services/mealGroupService` içinde; kazanan hesabı saf `utils/pollResult` çekirdeğinde.
 */

const svc = require('../services/mealGroupService');
const { sendHttpError } = require('../utils/httpError');
const { logRequest } = require('../services/logService');

// GET /api/meal-groups
async function getMyGroups(req, res, next) {
  try {
    res.json(await svc.getMyGroups(req.user.id));
  } catch (err) { sendHttpError(res, err, next); }
}

// GET /api/meal-groups/:id
async function getGroup(req, res, next) {
  try {
    res.json(await svc.getGroup(req.user.id, req.params.id));
  } catch (err) { sendHttpError(res, err, next); }
}

// POST /api/meal-groups
async function createGroup(req, res, next) {
  try {
    const group = await svc.createGroup(req.user.id, req.body);
    logRequest({ req, page: 'Gruplar', action: 'Grup oluşturdu', details: group.id }).catch(() => {});
    res.status(201).json(group);
  } catch (err) { sendHttpError(res, err, next); }
}

// POST /api/meal-groups/:id/respond
async function respondToInvite(req, res, next) {
  try {
    const updated = await svc.respondToInvite(req.user.id, req.params.id, req.body);
    const action = req.body.status === 'ACCEPTED' ? 'Grup davetine katıldı' : 'Grup davetine reddetti';
    logRequest({ req, page: 'Gruplar', action, details: req.params.id }).catch(() => {});
    res.json(updated);
  } catch (err) { sendHttpError(res, err, next); }
}

// POST /api/meal-groups/:id/members
async function addMembers(req, res, next) {
  try {
    const updated = await svc.addMembers(req.user.id, req.params.id, req.body);
    logRequest({ req, page: 'Gruplar', action: 'Gruba üye ekledi', details: req.params.id }).catch(() => {});
    res.json(updated);
  } catch (err) { sendHttpError(res, err, next); }
}

// POST /api/meal-groups/:id/polls
async function createPoll(req, res, next) {
  try {
    const poll = await svc.createPoll(req.user.id, req.params.id, req.body);
    logRequest({ req, page: 'Gruplar', action: 'Anket oluşturdu', details: req.params.id }).catch(() => {});
    res.status(201).json(poll);
  } catch (err) { sendHttpError(res, err, next); }
}

// POST /api/meal-groups/:groupId/polls/:pollId/vote
async function vote(req, res, next) {
  try {
    res.json(await svc.vote(req.user.id, req.params.groupId, req.params.pollId, req.body));
  } catch (err) { sendHttpError(res, err, next); }
}

// POST /api/meal-groups/:groupId/polls/:pollId/close
async function closePoll(req, res, next) {
  try {
    const result = await svc.closePoll(req.user.id, req.params.groupId, req.params.pollId);
    logRequest({ req, page: 'Gruplar', action: 'Anketi kapattı', details: req.params.pollId }).catch(() => {});
    res.json(result);
  } catch (err) { sendHttpError(res, err, next); }
}

// POST /api/meal-groups/:id/quick-poll
async function quickPoll(req, res, next) {
  try {
    const poll = await svc.quickPoll(req.user.id, req.params.id, req.body);
    logRequest({ req, page: 'Gruplar', action: 'Hızlı anket başlattı', details: req.params.id }).catch(() => {});
    res.status(201).json(poll);
  } catch (err) { sendHttpError(res, err, next); }
}

module.exports = { getMyGroups, getGroup, createGroup, respondToInvite, addMembers, createPoll, vote, closePoll, quickPoll };
