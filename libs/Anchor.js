'use strict';

const Web3 = require('web3');
const MosaicTbd = require('mosaic-tbd');
const AbiBinProvider = MosaicTbd.AbiBinProvider;
const ContractName = 'Anchor';

class Anchor {
  constructor(sourceWeb3, destinationWeb3, anchor, organization, confirmations, options) {
    const oThis = this;

    if (typeof sourceWeb3 === 'string') {
      sourceWeb3 = new Web3(sourceWeb3);
    }
    if (sourceWeb3 instanceof Web3) {
      oThis.sourceWeb3 = sourceWeb3;
    } else {
      let err = new Error("Mandatory Parameter 'sourceWeb3' is missing or invalid");
      throw err;
    }

    if (typeof destinationWeb3 === 'string') {
      destinationWeb3 = new Web3(destinationWeb3);
    }
    if (destinationWeb3 instanceof Web3) {
      oThis.destinationWeb3 = destinationWeb3;
    } else {
      let err = new Error("Mandatory Parameter 'destinationWeb3' is missing or invalid.");
      throw err;
    }

    if (!Web3.utils.isAddress(anchor)) {
      let err = new Error("Mandatory Parameter 'anchor' is missing or invalid.");
      throw err;
    }

    oThis.organization = organization;
    options = Object.assign(
      {
        gasPrice: '0x5B9ACA00',
        gas: '5000000',
        from: organization
      },
      options || {}
    );

    oThis.txOptions = options;
    oThis.confirmations = confirmations || Anchor.DEFAULT_CONFIRMATIONS;

    let abiBinProvider = new AbiBinProvider();
    let jsonInterface = abiBinProvider.getABI(ContractName);
    oThis.contract = new destinationWeb3.eth.Contract(jsonInterface, anchor, options);
  }

  anchorStateRoot(block, txOptions) {
    const oThis = this;

    txOptions = Object.assign(
      {
        gasPrice: '0x5B9ACA00',
        gas: '1000000',
        from: oThis.organization
      },
      oThis.txOptions || {},
      txOptions || {}
    );

    return oThis._anchorStateRoot(block, txOptions).then(function(tx) {
      return tx
        .send(txOptions)
        .on('transactionHash', function(transactionHash) {
          console.log('\t - transaction hash:', transactionHash);
        })
        .on('receipt', function(receipt) {
          console.log('\t - Receipt:\n\x1b[2m', JSON.stringify(receipt), '\x1b[0m\n');
        })
        .on('error', function(error) {
          console.log('\t !! Error !!', error, '\n\t !! ERROR !!\n');
          return Promise.reject(error);
        });
    });
  }

  _anchorStateRoot(block, txOptions) {
    const oThis = this;

    txOptions = Object.assign(
      {
        gasPrice: '0x5B9ACA00',
        gas: '1000000',
        from: oThis.organization
      },
      oThis.txOptions || {},
      txOptions || {}
    );

    if (!txOptions.from || !Web3.utils.isAddress(txOptions.from)) {
      let err = new Error("Mandatory Parameter 'organization' is missing or invalid.");
      return Promise.reject(err);
    }

    let contract = oThis.contract;
    let promiseChain;
    if (block) {
      promiseChain = new Promise(function(resolve, reject) {
        resolve(block);
      });
    } else {
      promiseChain = oThis.getSourceBlock();
    }

    return promiseChain.then(function(block) {
      let tx = contract.methods.anchorStateRoot(block.number, block.stateRoot);
      return tx;
    });
  }

  getSourceBlock() {
    const oThis = this;
    let web3 = oThis.sourceWeb3;
    let confirmations = oThis.confirmations;
    return web3.eth
      .getBlockNumber()
      .then(function(currentBlockNumber) {
        let commitableBlockNumber = currentBlockNumber - confirmations;
        console.log(
          '\t - currentBlockNumber:',
          currentBlockNumber,
          'commitableBlockNumber',
          commitableBlockNumber,
          'confirmations',
          confirmations
        );
        return web3.eth.getBlock(commitableBlockNumber);
      })
      .then(function(block) {
        console.log('\t - Block:\n\x1b[2m', JSON.stringify(block), '\x1b[0m\n');
        return block;
      });
  }

  getLatestStateRootBlockHeight() {
    const oThis = this;
    return oThis.contract.methods.getLatestStateRootBlockHeight().call();
  }

  validate() {
    const oThis = this;

    let sourceWeb3 = oThis.sourceWeb3;
    let destinationWeb3 = oThis.destinationWeb3;
    let contract = oThis.contract;
    let organization = oThis.organization;

    let sourceChainId;
    console.log('* Validating anchor');
    console.log('\t - validating chainId of source.');
    return sourceWeb3.eth.net
      .getId()
      .then(function(chainId) {
        sourceChainId = chainId;
        return contract.methods.getRemoteChainId().call();
      })
      .then(function(destinationChainId) {
        if (Number(sourceChainId) !== Number(destinationChainId)) {
          let error = new Error('Invalid sourceWeb3. The chainId does not match.');
          console.log('\t !! Error !!', error, '\n\t !! ERROR !!\n');
          throw error;
        }
        console.log('\t - validating organization address');
        return contract.methods.organization().call();
      })
      .then(function(organizationContract) {
        let abiBinProvider = new AbiBinProvider();
        let jsonInterface = abiBinProvider.getABI('organization');
        let orgContract = new destinationWeb3.eth.Contract(jsonInterface, organizationContract);
        return orgContract.methods.isOrganization(organization).call();
      })
      .then(function(flag) {
        if (!flag) {
          let error = new Error('Invalid organization address.');
          console.log('\t !! Error !!', error, '\n\t !! ERROR !!\n');
          throw error;
        }
        console.log('\t - all validations done');
        return true;
      });
  }

  static get DEFAULT_CONFIRMATIONS() {
    return 24;
  }
}

module.exports = Anchor;
