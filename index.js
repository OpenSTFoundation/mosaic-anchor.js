'use strict';

const Web3 = require('web3');
const MosaicTbd = require('@openstfoundation/mosaic-tbd');

module.exports = {
  AbiBinProvider: MosaicTbd.AbiBinProvider,
  Anchor: require('./libs/Anchor'),
  Job: require('./libs/Job')
};
