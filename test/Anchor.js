'use strict';

// Load external packages
const chai = require('chai'),
  Web3 = require('web3'),
  MosaicTbd = require('mosaic-tbd'),
  OrganizationHelper = MosaicTbd.ChainSetup.OrganizationHelper,
  AnchorHelper = MosaicTbd.ChainSetup.SafeCoreHelper,
  assert = chai.assert;

const config = require('../tests/utils/configReader'),
  Web3WalletHelper = require('../tests/utils/Web3WalletHelper');

const web3 = new Web3(config.gethRpcEndPoint);
let web3WalletHelper = new Web3WalletHelper(web3);

//Contract Address. TBD: Do not forget to set caOrganization && caAnchor = null below.
let caOrganization = null;
let caAnchor = null;
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

  let coreChainId = '123456';
  let initialBlockHeight, initialStateRoot;

  before(function() {
    //This hook could take long time.
    this.timeout(10 * 60 * 1000);

    return web3WalletHelper
      .init(web3)
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

  it('should commit state root', function() {
    this.timeout(10 * 1000);
    let sourceWeb3 = web3;
    let destinationWeb3 = web3;
    let address = caAnchor;
    let worker = orgOwner;
    let confirmations = 1;
    let oAnchor = new Package.Anchor(sourceWeb3, destinationWeb3, address, worker, confirmations);
    return oAnchor.execute().then(validateReceipt);
  });
});
