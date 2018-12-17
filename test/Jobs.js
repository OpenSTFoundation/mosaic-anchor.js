'use strict';

// Load external packages
const chai = require('chai'),
  Web3 = require('web3'),
  MosaicTbd = require('mosaic-tbd'),
  OrganizationHelper = MosaicTbd.ChainSetup.OrganizationHelper,
  AnchorHelper = MosaicTbd.ChainSetup.SafeCoreHelper,
  assert = chai.assert;

const config = require('../test/utils/configReader'),
  Web3WalletHelper = require('../test/utils/Web3WalletHelper');

const web3 = new Web3(config.gethRpcEndPoint);
let web3WalletHelper = new Web3WalletHelper(web3);

//Contract Address. TBD: Do not forget to set caOrganization && caAnchor = null below.
// let caOrganization = null;
// let caAnchor = null;
// let coreChainId = null;
// let orgOwner = config.deployerAddress;
// let orgWorker = config.organizationWorker;

let caOrganization = '0x77dE44cACfAaB4deCc91F67400cb4537CD1C1d93';
let caAnchor = '0x73D2B0221EB8b67b267B7Cd3Dd4eA7dFd18BCCD4';
let coreChainId = 1000;
let orgOwner = config.deployerAddress;
let orgWorker = config.organizationWorker;

let validateReceipt = (receipt) => {
  assert.isNotNull(receipt, 'Transaction Receipt is null');
  assert.isObject(receipt, 'Transaction Receipt is not an object');
  assert.isTrue(receipt.status, 'Transaction failed.');
  return receipt;
};

let validateDeploymentReceipt = (receipt) => {
  validateReceipt(receipt);
  let contractAddress = receipt.contractAddress;
  assert.isNotEmpty(contractAddress, 'Deployment Receipt is missing contractAddress');
  assert.isTrue(web3.utils.isAddress(contractAddress), 'Invalid contractAddress in Receipt');
  return receipt;
};
describe('test/helpers/Anchor', function() {
  let deployParams = {
    from: config.deployerAddress,
    gasPrice: config.gasPrice
  };

  let helper = new AnchorHelper(web3, caAnchor);

  let initialBlockHeight, initialStateRoot;

  before(function() {
    //This hook could take long time.
    this.timeout(10 * 60 * 1000);

    return web3WalletHelper
      .init(web3)
      .then(function(_out) {
        if (!coreChainId) {
          return web3.eth.net.getId().then(function(chainId) {
            coreChainId = chainId;
          });
        }
        return _out;
      })
      .then(function(_out) {
        if (!caOrganization) {
          console.log('* Setting up Organization');
          let orgHelper = new OrganizationHelper(web3, caOrganization);
          const orgConfig = {
            deployer: config.deployerAddress,
            worker: orgOwner
          };
          return orgHelper.setup(orgConfig).then(function() {
            caOrganization = orgHelper.address;
          });
        }
        return _out;
      })
      .then(function(_out) {
        if (!caAnchor) {
          console.log('Getting latest block');
          let confirmations = 24 * 2;
          return web3.eth.getBlockNumber().then(function(currentBlockNumber) {
            let commitableBlockNumber = currentBlockNumber - confirmations;
            return web3.eth.getBlock(commitableBlockNumber).then(function(block) {
              console.log('block', block);
              initialBlockHeight = block.number;
              initialStateRoot = block.stateRoot;
              return helper
                .deploy(coreChainId, initialBlockHeight, initialStateRoot, caOrganization, deployParams)
                .then(validateDeploymentReceipt)
                .then((receipt) => {
                  caAnchor = receipt.contractAddress;
                });
            });
          });
        }
        return _out;
      });
  });

  let Package = require('../index');

  it('should run the job', function() {
    this.timeout(60 * 60 * 1000);
    let sourceWeb3 = web3;
    let destinationWeb3 = web3;
    let address = caAnchor;
    let worker = orgOwner;
    let oJob = new Package.Job(sourceWeb3, destinationWeb3, address, worker);
    return oJob.execute(20).on('StateRootAvailable', function(receipt) {
      validateReceipt(receipt);
    });
  });
});

// Go easy on RPC Client (Geth)
(function() {
  let maxHttpScokets = 5;
  let httpModule = require('http');
  httpModule.globalAgent.keepAlive = true;
  httpModule.globalAgent.keepAliveMsecs = 30 * 60 * 1000;
  httpModule.globalAgent.maxSockets = maxHttpScokets;
})();