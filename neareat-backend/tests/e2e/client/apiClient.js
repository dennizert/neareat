'use strict';

/**
 * Arayüz simülatörü — mobil uygulamanın yerine geçen API istemcisi.
 *
 * "Frontend olmadan frontend testi"nin çekirdeği burasıdır. Mobil uygulama ekranlardan
 * doğrudan HTTP çağırmaz; `src/services/*.ts` katmanını çağırır (`auth.loginWithEmail`,
 * `reservations.createReservation`, …). Bu istemci o katmanın AYNASIDIR: aynı isimler,
 * aynı parametreler, aynı dönüş şekilleri.
 *
 * Kazancı iki yönlü:
 *  1. Testler kullanıcı EYLEMİ gibi okunur (`await user.reservations.create({...})`),
 *     HTTP ayrıntısı (`POST /api/reservations`, header, token) gibi değil.
 *  2. Mobilin gerçekten tükettiği sözleşme test edilir. Bir uç `code` alanını
 *     döndürmeyi bırakırsa test kırılır — çünkü mobil de tam olarak ona bakıyor.
 *
 * Hata davranışı da mobilinkini taklit eder: axios gibi, 2xx dışı yanıtlarda `status`
 * ve `body` taşıyan bir hata FIRLATIR. Böylece testler mobilin dallandığı gibi
 * dallanabilir (`err.body.code === 'LEVEL_REQUIRED'`).
 */

const request = require('supertest');

/** 2xx dışı yanıtlarda fırlatılan hata — mobildeki axios hatasının karşılığı. */
class ApiError extends Error {
  constructor(method, path, status, body) {
    super(`${method} ${path} → ${status}: ${body?.error || JSON.stringify(body)}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body || {};
  }
}

/**
 * Tek bir oturumu (bir kullanıcıyı) temsil eden istemci.
 * Mobildeki `authStore` gibi token'ı içinde tutar ve her isteğe otomatik ekler.
 */
class ApiClient {
  constructor(app) {
    this.app = app;
    this.token = null;
    this.user = null;

    // Mobil servis dosyalarının aynası. Gruplama, `src/services/*.ts` dosya adlarını izler.
    this.auth = this._auth();
    this.restaurants = this._restaurants();
    this.reservations = this._reservations();
    this.favorites = this._favorites();
    this.social = this._social();
    this.reviews = this._reviews();
    this.mealGroups = this._mealGroups();
    this.restaurantAccount = this._restaurantAccount();
    this.admin = this._admin();
    this.checkin = this._checkin();
    this.notifications = this._notifications();
  }

  /** Oturumu elle ayarlar (fabrikayla oluşturulmuş kullanıcılar için). */
  authenticate(token, user = null) {
    this.token = token;
    this.user = user;
    return this;
  }

  /** Mobildeki `signOut` karşılığı. */
  logout() {
    this.token = null;
    this.user = null;
    return this;
  }

  // ─── Taşıma katmanı ────────────────────────────────────────────────────────

  async _send(method, path, { body, query, headers } = {}) {
    let req = request(this.app)[method](path);
    if (this.token) req = req.set('Authorization', `Bearer ${this.token}`);
    if (headers) for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
    if (query) req = req.query(query);
    if (body !== undefined) req = req.send(body);

    const res = await req;
    if (res.status >= 400) throw new ApiError(method.toUpperCase(), path, res.status, res.body);
    return res.body;
  }

  _get(path, opts) { return this._send('get', path, opts); }
  _post(path, body, opts) { return this._send('post', path, { ...opts, body }); }
  _put(path, body, opts) { return this._send('put', path, { ...opts, body }); }
  _delete(path, opts) { return this._send('delete', path, opts); }

  // ─── services/auth.ts ──────────────────────────────────────────────────────

  _auth() {
    return {
      registerWithEmail: async (email, password, displayName) => {
        const data = await this._post('/api/auth/register', { email, password, displayName });
        // Mobil kayıt sonrası token'ı saklar ve oturumu açar — aynısını yap.
        this.authenticate(data.token, data.user);
        return data;
      },
      loginWithEmail: async (email, password) => {
        const data = await this._post('/api/auth/login/email', { email, password });
        this.authenticate(data.token, data.user);
        return data;
      },
      signInWithGoogle: async (idToken) => {
        const data = await this._post('/api/auth/login', { idToken });
        if (data.token) this.authenticate(data.token, data.user);
        return data;
      },
      getMe: () => this._get('/api/auth/me'),
      verifyEmail: (token) => this._post('/api/auth/verify-email', { token }),
      resendVerification: () => this._post('/api/auth/resend-verification', {}),
      forgotPassword: (email) => this._post('/api/auth/forgot-password', { email }),
      resetPassword: (token, password) => this._post('/api/auth/reset-password', { token, password }),
    };
  }

  // ─── services/restaurants.ts + discovery.ts ────────────────────────────────

  _restaurants() {
    return {
      getNearby: (params) => this._get('/api/restaurants/nearby', { query: params }),
      getDetails: (placeId) => this._get(`/api/restaurants/${placeId}`),
      search: (params) => this._get('/api/places/search', { query: params }),
    };
  }

  // ─── services/reservations.ts ──────────────────────────────────────────────

  _reservations() {
    return {
      create: (params) => this._post('/api/reservations', params),
      getMine: () => this._get('/api/reservations/me'),
      getDetail: (id) => this._get(`/api/reservations/${id}`),
      cancel: (id) => this._delete(`/api/reservations/${id}`),
      update: (id, params) => this._put(`/api/reservations/${id}`, params),
      getAvailability: (placeId, date, time, guestCount) =>
        this._get('/api/reservations/availability', { query: { placeId, date, time, guestCount } }),
      // Restoran tarafı
      getForRestaurant: (status, date) =>
        this._get('/api/reservations/restaurant', { query: { ...(status && { status }), ...(date && { date }) } }),
      updateStatus: (id, status, rejectionReason, reservedSeats) =>
        this._put(`/api/reservations/${id}/status`, { status, rejectionReason, reservedSeats }),
      markAttendance: (id, attended) => this._put(`/api/reservations/${id}/attendance`, { attended }),
      sendMessage: (id, content) => this._post(`/api/reservations/${id}/messages`, { content }),
      getMessages: (id) => this._get(`/api/reservations/${id}/messages`),
    };
  }

  // ─── services/favorites.ts ─────────────────────────────────────────────────

  _favorites() {
    return {
      list: () => this._get('/api/favorites'),
      add: (params) => this._post('/api/favorites', params),
      remove: (placeId) => this._delete(`/api/favorites/${placeId}`),
    };
  }

  // ─── services/social.ts ────────────────────────────────────────────────────

  _social() {
    return {
      searchUsers: (q) => this._get('/api/social/users/search', { query: { q } }),
      getFriends: () => this._get('/api/social/friends'),
      getPendingRequests: () => this._get('/api/social/friends/requests'),
      sendFriendRequest: (toUserId, note) => this._post('/api/social/friends/requests', { toUserId, note }),
      acceptFriendRequest: (id) => this._post(`/api/social/friends/requests/${id}/accept`, {}),
      rejectFriendRequest: (id) => this._post(`/api/social/friends/requests/${id}/reject`, {}),
      removeFriend: (id) => this._delete(`/api/social/friends/${id}`),
      sendRecommendation: (params) => this._post('/api/social/recommendations', params),
      getReceivedRecommendations: () => this._get('/api/social/recommendations/received'),
      getStarEvents: () => this._get('/api/social/stars'),
      getLeaderboard: () => this._get('/api/social/leaderboard'),
      rateRestaurant: (placeId, placeName) => this._post('/api/social/stars/rating', { placeId, placeName }),
      getActivityFeed: (params) => this._get('/api/social/feed', { query: params }),
      reportUser: (userId, reason) => this._post(`/api/social/users/${userId}/report`, { reason }),
    };
  }

  // ─── services/restaurants.ts (yorumlar) ────────────────────────────────────

  _reviews() {
    return {
      create: (params) => this._post('/api/reviews', params),
      listForPlace: (placeId, params) => this._get(`/api/reviews/${placeId}`, { query: params }),
    };
  }

  // ─── services/mealGroups.ts ────────────────────────────────────────────────

  _mealGroups() {
    return {
      list: () => this._get('/api/meal-groups'),
      get: (id) => this._get(`/api/meal-groups/${id}`),
      create: (name, memberIds) => this._post('/api/meal-groups', { name, memberIds }),
      respondToInvite: (id, status) => this._post(`/api/meal-groups/${id}/respond`, { status }),
      addMembers: (id, memberIds) => this._post(`/api/meal-groups/${id}/members`, { memberIds }),
      createPoll: (id, question, options) => this._post(`/api/meal-groups/${id}/polls`, { question, options }),
      vote: (groupId, pollId, optionId, vote) =>
        this._post(`/api/meal-groups/${groupId}/polls/${pollId}/vote`, { optionId, vote }),
      closePoll: (groupId, pollId) => this._post(`/api/meal-groups/${groupId}/polls/${pollId}/close`, {}),
    };
  }

  // ─── services/restaurantAccount.ts ─────────────────────────────────────────

  _restaurantAccount() {
    return {
      register: (params) => this._post('/api/restaurant-account/register', params),
      getMyProfile: () => this._get('/api/restaurant-account/me'),
      updateInfo: (params) => this._put('/api/restaurant-account/info', params),
      getStats: () => this._get('/api/restaurant-account/stats'),
      getOccupancy: (date) => this._get('/api/restaurant-account/occupancy', { query: { date } }),
      getAnalytics: () => this._get('/api/restaurant-account/analytics'),
      sendCampaign: (message, audience) => this._post('/api/restaurant-account/campaign', { message, audience }),
      replyToReview: (reviewId, content) => this._post(`/api/restaurant-account/reviews/${reviewId}/reply`, { content }),
    };
  }

  // ─── services/admin.ts ─────────────────────────────────────────────────────

  _admin() {
    return {
      login: async (email, password) => {
        const data = await this._post('/api/admin/login', { email, password });
        this.authenticate(data.token, data.user);
        return data;
      },
      getPendingRestaurants: (params) => this._get('/api/admin/restaurants', { query: params }),
      approveRestaurant: (id) => this._post(`/api/admin/restaurants/${id}/approve`, {}),
      rejectRestaurant: (id, rejectionReason) => this._post(`/api/admin/restaurants/${id}/reject`, { rejectionReason }),
      getStats: () => this._get('/api/admin/stats'),
      suspendUser: (id) => this._post(`/api/admin/users/${id}/suspend`, {}),
    };
  }

  // ─── services/checkin.ts ───────────────────────────────────────────────────

  _checkin() {
    return {
      create: (params) => this._post('/api/checkin', params),
      list: () => this._get('/api/checkin'),
    };
  }

  // ─── services/notifications.ts ─────────────────────────────────────────────

  _notifications() {
    return {
      list: (params) => this._get('/api/notifications', { query: params }),
      markRead: (id) => this._put(`/api/notifications/${id}/read`, {}),
    };
  }
}

/** Yeni bir "uygulama oturumu" açar — mobilde uygulamayı açmanın karşılığı. */
function createClient(app) {
  return new ApiClient(app);
}

module.exports = { createClient, ApiClient, ApiError };
