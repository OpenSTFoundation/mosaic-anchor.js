'use strict';

const Web3 = require('web3');
const MosaicTbd = require('mosaic-tbd');
const AbiBinProvider = MosaicTbd.AbiBinProvider;
const ContractName = 'SafeCore';

class Anchor {
  constructor(sourceWeb3, destinationWeb3, address, worker, confirmations, options) {
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

    if (!Web3.utils.isAddress(address)) {
      let err = new Error("Mandatory Parameter 'address' is missing or invalid.");
      throw err;
    }

    oThis.worker = worker;
    options = Object.assign(
      {
        gasPrice: '0x5B9ACA00',
        gas: '5000000',
        from: worker
      },
      options || {}
    );

    oThis.confirmations = confirmations || 24;

    let abiBinProvider = new AbiBinProvider();
    let jsonInterface = abiBinProvider.getABI(ContractName);
    oThis.contract = new destinationWeb3.eth.Contract(jsonInterface, address, options);
  }

  execute(txOptions) {
    const oThis = this;

    txOptions = Object.assign(
      {
        gasPrice: '0x5B9ACA00',
        gas: '5000000',
        from: oThis.worker
      },
      txOptions || {}
    );

    if (!txOptions.from || !Web3.utils.isAddress(txOptions.from)) {
      let err = new Error("Mandatory Parameter 'worker' is missing or invalid.");
      return Promise.reject(err);
    }

    let contract = oThis.contract;
    return oThis.getSourceBlock().then(function(block) {
      let tx = contract.methods.commitStateRoot(block.number, block.stateRoot);
      console.log('* Committing stateRoot at blockHeight', block.number);
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

  getSourceBlock() {
    const oThis = this;
    let web3 = oThis.sourceWeb3;
    let confirmations = oThis.confirmations;
    return web3.eth
      .getBlockNumber()
      .then(function(currentBlockNumber) {
        let commitableBlockNumber = currentBlockNumber - confirmations;
        return web3.eth.getBlock(commitableBlockNumber);
      })
      .then(function(block) {
        console.log('\t - Block:\n\x1b[2m', JSON.stringify(block), '\x1b[0m\n');
        return block;
      });
  }
}

module.exports = Anchor;
