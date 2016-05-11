/*
 *  app.js
 *
 *  David Janes
 *  IOTDB
 *  2016-05-11
 *
 *  Demonstrate using Facebook's AccountKit
 */

"use struct";

const iotdb = require('iotdb');
const _ = iotdb._;

const Q = require('q');
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require("body-parser");
const mustache = require('mustache');
const querystring = require('querystring');
const unirest = require('unirest');
const crypto = require('crypto');

// --- setup account --- 

const accountd = require('./account.json');

const URL_ME = "https://graph.accountkit.com/" + accountd.api_version + "/me";
const URL_TOKEN_EXCHANGE = "https://graph.accountkit.com/" + accountd.api_version + "/access_token";

var csrf_guid = _.random.id(64);

// --- webpages --- 
const page_login = function (request, response) {
    const template = fs.readFileSync(path.join(__dirname, 'login.html')).toString();
    const templated = {
        csrf: csrf_guid,
        app_id: accountd.facebook_app_id,
        api_version: accountd.api_version,
    };

    response.send(mustache.to_html(template, templated));
};

/**
 *  Q-ed login verification. Much longer than it could be,
 *  but hopefully clearer and more reliable
 */
const page_login_verify = function (request, response) {
    // validate the request's CSRF
    const _validate_csrf = (self, done) => {
        if (self.in_body.csrf_nonce !== csrf_guid) {
            return new Error("CSRF fail");
        }

        done(null, self);
    };

    // make the URL for token exchange
    const _token_exchange_make_url = (self, done) => {
        var app_access_token = [ 'AA', accountd.facebook_app_id, accountd.accountkit_secret ].join('|');
        var paramd = {
            grant_type: 'authorization_code',
            code: self.in_body.code,
            access_token: app_access_token,
        };

        self.url_token_exchange = URL_TOKEN_EXCHANGE + '?' + querystring.stringify(paramd);

        done(null, self);
    };

    // do the token exchange
    const _token_exchange_request = (self, done) => {
        unirest
            .get(self.url_token_exchange)
            .json()
            .end((token_exchange_response) => {
                if (token_exchange_response.error) {
                    return done(token_exchange_response.error);
                }

                self.token = token_exchange_response.body;
                done(null, self);
            });
    };

    // make an extra secret facebook likes - NOT COMPUTING RIGHT VALUE, HELP ME
    const _appsecret_proof_make = (self, done) => {
        var hmac = crypto.createHmac('sha256', self.token.access_token);
        hmac.update(accountd.accountkit_secret);
                                    
        self.appsecret_proof = hmac.digest('hex');
        self.appsecret_proof = null;
        
        done(null, self);
    };

    // make the url to get "me"
    const _me_make_url = (self, done) => {
        var paramd = {
            access_token: self.token.access_token,
        };

        if (self.appsecret_proof) {
            paramd.appsecret_proof = self.appsecret_proof;
        }

        self.url_me = URL_ME + '?' + querystring.stringify(paramd);

        done(null, self);
    };

    // actually get "me"
    const _me_request = (self, done) => {
        unirest
            .get(self.url_me)
            .json()
            .end((me_response) => {
                console.log(me_response);
                if (me_response.error) {
                    return done(me_response.error);
                }

                self.me = me_response.body;
                done(null, self);
            });
    };

    // make the templates used for the OK response
    const _response_ok_templates = (self, done) => {
        self.template = fs.readFileSync(path.join(__dirname, 'login_success.html')).toString();
        self.templated = {
            user_access_token: self.token.access_token,
            expires_at: self.token.expires_at,
            user_id: self.token.id,
        };

        if (self.me.phone) {
            self.templated.method = "SMS";
            self.templated.identity = self.me.phone.number;
        } else if (self.me.email) {
            self.templated.method = "Email";
            self.templated.identity = self.me.email.address;
        }

        self.out_body = mustache.to_html(self.template, self.templated);

        done(null, self);
    };

    // actually make the response
    const _response_ok_make = (self, done) => {
        self.out_body = mustache.to_html(self.template, self.templated);

        done(null, self);
    };

    // response OK
    const _response_ok_send = (self, done) => {
        response.send(self.out_body);

        done(null, self);
    };

    // response error
    const _response_error = function (error) {
        return response.status(_.error.status(error, 400)).send(_.error.message(error));
    };

    // put it all together
    Q({ in_body: request.body, })
        .then(Q.denodeify(_validate_csrf))
        .then(Q.denodeify(_token_exchange_make_url))
        .then(Q.denodeify(_token_exchange_request))
        .then(Q.denodeify(_appsecret_proof_make))
        .then(Q.denodeify(_me_make_url))
        .then(Q.denodeify(_me_request))
        .then(Q.denodeify(_response_ok_templates))
        .then(Q.denodeify(_response_ok_make))
        .then(Q.denodeify(_response_ok_send))
        .catch(_response_error);
};

// --- express app --- 

const app = express();

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());
app.get('/', page_login);
app.post('/sendcode', page_login_verify);
app.get('/sendcode', (request, response) => {
    return response.redirect("/");
});

app.listen(accountd.port || 3000);
