'use strict';

const Web3 = require('web3');
const MosaicTbd = require('mosaic-tbd');

module.exports = {
  AbiBinProvider: MosaicTbd.AbiBinProvider,
  Anchor: require('./libs/Anchor'),
  Job: require('./libs/Job')
};
