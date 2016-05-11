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
const guid = require('guid');
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

var csrf_guid = guid.raw();

// --- webpages --- 
const page_login = function (request, response) {
    const template = fs.readFileSync('login.html').toString();
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
    const _validate_csrf = function (contextd, done) {
        if (contextd.in_body.csrf_nonce !== csrf_guid) {
            return new Error("CSRF fail");
        }

        done(null, contextd);
    };

    // make the URL for token exchange
    const _token_exchange_make_url = function (contextd, done) {
        var app_access_token = ['AA', accountd.facebook_app_id, accountd.accountkit_secret].join('|');
        var params = {
            grant_type: 'authorization_code',
            code: contextd.in_body.code,
            access_token: app_access_token,
            // appsecret_proof: appsecret_proof,
        };

        contextd.url_token_exchange = URL_TOKEN_EXCHANGE + '?' + querystring.stringify(params);

        done(null, contextd);
    };

    // do the token exchange
    const _token_exchange_request = function (contextd, done) {
        unirest
            .get(contextd.url_token_exchange)
            .json()
            .end((token_exchange_response) => {
                if (token_exchange_response.error) {
                    return done(token_exchange_response.error);
                }

                contextd.token = token_exchange_response.body;
                done(null, contextd);
            });
    };

    // make the url to get "me"
    const _me_make_url = function (contextd, done) {
        contextd.url_me = URL_ME + '?access_token=' + contextd.token.access_token;

        done(null, contextd);
    };

    // actually get "me"
    const _me_request = function (contextd, done) {
        unirest
            .get(contextd.url_me)
            .json()
            .end((me_response) => {
                if (me_response.error) {
                    return done(me_response.error);
                }

                contextd.me = me_response.body;
                done(null, contextd);
            });
    };

    // make the templates used for the OK response
    const _response_ok_templates = function (contextd, done) {
        contextd.template = fs.readFileSync('login_success.html').toString();
        contextd.templated = {
            user_access_token: contextd.token.access_token,
            expires_at: contextd.token.expires_at,
            user_id: contextd.token.id,
        };

        if (contextd.me.phone) {
            contextd.templated.method = "SMS";
            contextd.templated.identity = contextd.me.phone.number;
        } else if (contextd.me.email) {
            contextd.templated.method = "Email";
            contextd.templated.identity = contextd.me.email.address;
        }

        contextd.out_body = mustache.to_html(contextd.template, contextd.templated);

        done(null, contextd);
    };

    // actually make the response
    const _response_ok_make = function (contextd, done) {
        contextd.out_body = mustache.to_html(contextd.template, contextd.templated);

        done(null, contextd);
    };

    // response OK
    const _response_ok_send = function (contextd, done) {
        response.send(contextd.out_body);

        done(null, contextd);
    };

    // response error
    const _response_error = function (error) {
        return response.status(400).send(_.error.message(error));
    };

    // put it all together
    Q({ in_body: request.body, })
        .then(Q.denodeify(_validate_csrf))
        .then(Q.denodeify(_token_exchange_make_url))
        .then(Q.denodeify(_token_exchange_request))
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

app.listen(3000);
/*
    console.log(request.body);


    var hmac = crypto.createHmac('sha256', accountd.accountkit_secret);
    hmac.update(request.body.code);
                                
    var appsecret_proof = hmac.digest('hex');
    */
