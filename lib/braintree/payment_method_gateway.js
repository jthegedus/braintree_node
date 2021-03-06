'use strict';

let Gateway = require('./gateway').Gateway;
let ApplePayCard = require('./apple_pay_card').ApplePayCard;
let AndroidPayCard = require('./android_pay_card').AndroidPayCard;
let CreditCard = require('./credit_card').CreditCard;
let PayPalAccount = require('./paypal_account').PayPalAccount;
let CoinbaseAccount = require('./coinbase_account').CoinbaseAccount;
let UnknownPaymentMethod = require('./unknown_payment_method').UnknownPaymentMethod;
let PaymentMethodNonce = require('./payment_method_nonce').PaymentMethodNonce;
let UsBankAccount = require('./us_bank_account').UsBankAccount;
let VenmoAccount = require('./venmo_account').VenmoAccount;
let VisaCheckoutCard = require('./visa_checkout_card').VisaCheckoutCard;
let MasterpassCard = require('./masterpass_card').MasterpassCard;
let Util = require('./util').Util;
let exceptions = require('./exceptions');
let querystring = require('../../vendor/querystring.node.js.511d6a2/querystring');
let wrapPrototype = require('@braintree/wrap-promise').wrapPrototype;

class PaymentMethodGateway extends Gateway {
  constructor(gateway) {
    super();
    this.gateway = gateway;
    this.config = this.gateway.config;
  }

  responseHandler() {
    let responseMapping = {
      paypalAccount: PayPalAccount,
      coinbaseAccount: CoinbaseAccount,
      creditCard: CreditCard,
      applePayCard: ApplePayCard,
      androidPayCard: AndroidPayCard,
      paymentMethodNonce: PaymentMethodNonce
    };
    let handler = this.createResponseHandler(responseMapping, null);

    return function (payload) {
      return handler(payload).then(function (response) {
        let parsedResponse = PaymentMethodGateway.parsePaymentMethod(response);

        if (parsedResponse instanceof PaymentMethodNonce) {
          response.paymentMethodNonce = parsedResponse;
        } else {
          response.paymentMethod = parsedResponse;
        }

        return response;
      });
    };
  }

  create(attributes) {
    return this.gateway.http.post(`${this.config.baseMerchantPath()}/payment_methods`, {paymentMethod: attributes}).then(this.responseHandler());
  }

  find(token) {
    if (token.trim() === '') {
      return Promise.reject(exceptions.NotFoundError('Not Found'), null); // eslint-disable-line new-cap
    }

    return this.gateway.http.get(`${this.config.baseMerchantPath()}/payment_methods/any/${token}`).then((response) => {
      return PaymentMethodGateway.parsePaymentMethod(response);
    });
  }

  update(token, attributes) {
    if (token.trim() === '') {
      return Promise.reject(exceptions.NotFoundError('Not Found'), null); // eslint-disable-line new-cap
    }

    return this.gateway.http.put(`${this.config.baseMerchantPath()}/payment_methods/any/${token}`, {paymentMethod: attributes}).then(this.responseHandler());
  }

  grant(token, attributes) {
    if (token.trim() === '') {
      return Promise.reject(exceptions.NotFoundError('Not Found'), null); // eslint-disable-line new-cap
    }

    let grantOptions = {
      sharedPaymentMethodToken: token
    };

    if (typeof attributes === 'boolean') {
      attributes = {allow_vaulting: attributes}; // eslint-disable-line camelcase
    }

    grantOptions = Util.merge(grantOptions, attributes);
    return this.gateway.http.post(`${this.config.baseMerchantPath()}/payment_methods/grant`, {
      payment_method: grantOptions // eslint-disable-line camelcase
    }).then(this.responseHandler());
  }

  revoke(token) {
    if (token.trim() === '') {
      return Promise.reject(exceptions.NotFoundError('Not Found'), null); // eslint-disable-line new-cap
    }

    return this.gateway.http.post(`${this.config.baseMerchantPath()}/payment_methods/revoke`, {
      payment_method: { // eslint-disable-line camelcase
        sharedPaymentMethodToken: token
      }
    }).then(this.responseHandler());
  }

  static parsePaymentMethod(response) {
    if (response.creditCard) {
      return new CreditCard(response.creditCard);
    } else if (response.paypalAccount) {
      return new PayPalAccount(response.paypalAccount);
    } else if (response.applePayCard) {
      return new ApplePayCard(response.applePayCard);
    } else if (response.androidPayCard) {
      return new AndroidPayCard(response.androidPayCard);
    } else if (response.coinbaseAccount) {
      return new CoinbaseAccount(response.coinbaseAccount);
    } else if (response.paymentMethodNonce) {
      return new PaymentMethodNonce(response.paymentMethodNonce);
    } else if (response.usBankAccount) {
      return new UsBankAccount(response.usBankAccount);
    } else if (response.venmoAccount) {
      return new VenmoAccount(response.venmoAccount);
    } else if (response.visaCheckoutCard) {
      return new VisaCheckoutCard(response.visaCheckoutCard);
    } else if (response.masterpassCard) {
      return new MasterpassCard(response.masterpassCard);
    }

    return new UnknownPaymentMethod(response);
  }

  delete(token, options) {
    let queryParam, invalidKeysError;

    if (typeof options === 'function') {
      options = null;
    }
    invalidKeysError = Util.verifyKeys(this._deleteSignature(), options);

    if (invalidKeysError) {
      return Promise.reject(invalidKeysError);
    }
    queryParam = options != null ? '?' + querystring.stringify(Util.convertObjectKeysToUnderscores(options)) : '';

    return this.gateway.http.delete(this.config.baseMerchantPath() + '/payment_methods/any/' + token + queryParam);
  }

  _deleteSignature() {
    return {
      valid: ['revokeAllGrants']
    };
  }
}

module.exports = {PaymentMethodGateway: wrapPrototype(PaymentMethodGateway)};
