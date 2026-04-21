/* eslint-disable import/no-commonjs, import/order */
// Minimal bootstrap for pure unit tests that don't need mongoose/server wiring.
// Sets up global chai/sinon helpers (mirroring test/helpers/globals.helper.js)
// and nconf with the example config, nothing else.
//
// @babel/register must be installed BEFORE requiring any repo source file,
// because they use ES module syntax that Node can't parse natively.

require('@babel/register');

const nconf = require('nconf');
const setupNconf = require('../../website/server/libs/setupNconf').default;

const lodash = require('lodash');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinonChai = require('sinon-chai');
const sinon = require('sinon');

chai.use(chaiAsPromised);
chai.use(sinonChai);

global._ = lodash;
global.chai = chai;
global.expect = chai.expect;
global.sinon = sinon;
global.sandbox = sinon.createSandbox();

setupNconf('./config.json.example');
nconf.set('NODE_ENV', 'test');
nconf.set('IS_TEST', true);
