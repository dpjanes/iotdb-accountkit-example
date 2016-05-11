# iotdb-accountkit-example
Example of getting Started with Facebook's Account Kit

## About
Account Kit is Facebook's SMS / email login system,
e.g. could be used as an alternative to Twitter's Digits

https://developers.facebook.com/docs/accountkit

## Provenance

The original source is based on Auth0's 
https://github.com/auth0-blog/blog-passwordless-authentication
though it has been substantially rewritten to use unirest
and promises.

Promises make the code a lot longer, but hopefully every individual
step makes sense and is "correct".

## Help Needed

Right now the `appsecret_proof` is not working, so you'll have to
turn this off on the Facebook App Page. If you have some
insight into why this may be, let me know.

## Running

* set up a Facebook Web App
* enabled Account Kit (don't confuse Facebook App ID with Account Kit App Id)
* copy account.json.template account.json
* fill in the details
* `node app.js`
