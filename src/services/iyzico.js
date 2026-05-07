const Iyzipay = require('iyzipay');

let instance;

function getIyzico() {
  if (!instance) {
    instance = new Iyzipay({
      apiKey: process.env.IYZICO_API_KEY,
      secretKey: process.env.IYZICO_SECRET_KEY,
      uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com',
    });
  }
  return instance;
}

function createSubscriptionPlan(planData) {
  return new Promise((resolve, reject) => {
    getIyzico().subscriptionProduct.create(planData, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function createSubscriptionCheckoutForm(checkoutData) {
  return new Promise((resolve, reject) => {
    getIyzico().subscriptionCheckoutForm.initialize(checkoutData, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

module.exports = { getIyzico, createSubscriptionPlan, createSubscriptionCheckoutForm };
