/* eslint-disable import/no-commonjs */
// Minimal bootstrap for pure unit tests that don't need mongoose/server wiring.
// Sets up global chai/sinon helpers (mirroring test/helpers/globals.helper.js)
// and nconf with the example config, nothing else.

const nconf = require('nconf');
const setupNconf = require('../../website/server/libs/setupNconf').default;

require('@babel/register');

global._ = require('lodash');
global.chai = require('chai');
global.chai.use(require('chai-as-promised'));
global.chai.use(require('sinon-chai'));

global.expect = global.chai.expect;
global.sinon = require('sinon');

global.sandbox = global.sinon.createSandbox();

setupNconf('./config.json.example');
nconf.set('NODE_ENV', 'test');
nconf.set('IS_TEST', true);
