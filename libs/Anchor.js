'use strict';

const Web3 = require('web3');
const MosaicTbd = require('mosaic-tbd');
const AbiBinProvider = MosaicTbd.AbiBinProvider;
const ContractName = 'SafeCore';

class Anchor {
  constructor(sourceWeb3, destinationWeb3, anchor, worker, confirmations, options) {
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

    oThis.worker = worker;
    options = Object.assign(
      {
        gasPrice: '0x5B9ACA00',
        gas: '5000000',
        from: worker
      },
      options || {}
    );

    oThis.confirmations = confirmations || Anchor.DEFAULT_CONFIRMATIONS;

    let abiBinProvider = new AbiBinProvider();
    let jsonInterface = abiBinProvider.getABI(ContractName);
    oThis.contract = new destinationWeb3.eth.Contract(jsonInterface, anchor, options);
  }

  commitStateRoot(block, txOptions) {
    const oThis = this;

    txOptions = Object.assign(
      {
        gasPrice: '0x5B9ACA00',
        gas: '1000000',
        from: oThis.worker
      },
      txOptions || {}
    );

    if (!txOptions.from || !Web3.utils.isAddress(txOptions.from)) {
      let err = new Error("Mandatory Parameter 'worker' is missing or invalid.");
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
    let worker = oThis.worker;

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
        console.log('\t - validating worker address');
        return contract.methods.membersManager().call();
      })
      .then(function(membersManager) {
        let abiBinProvider = new AbiBinProvider();
        let jsonInterface = abiBinProvider.getABI('organization');
        let orgContract = new destinationWeb3.eth.Contract(jsonInterface, membersManager);
        return orgContract.methods.isWorker(worker).call();
      })
      .then(function(flag) {
        if (!flag) {
          let error = new Error('Invalid worker address.');
          console.log('\t !! Error !!', error, '\n\t !! ERROR !!\n');
          throw error;
        }
        console.log('\t - all validations done');
        return true;
      });
  }

  getSourceAverageBlockGenerationTime() {
    const oThis = this;

    let web3 = oThis.sourceWeb3;
    return web3.eth.getBlockNumber().then(function(currentBlockNumber) {
      currentBlockNumber = Number(currentBlockNumber);
      let confirmations = oThis.confirmations;

      let totalBlocksToFetch = confirmations * 2;
      let endBlock = currentBlockNumber - confirmations;
      let startBlock = endBlock - totalBlocksToFetch;

      //
      //  Create a batch request to fetch last 100 blocks
      //  and Calculate avg block generation time.
      //

      let calculatorPromise = new Promise(function(resolve, reject) {
        console.log('inside calculatorPromise');

        let blocks = [];
        let calculator = function() {
          if (blocks.length < 2) {
            let error = new Error('Failed to fetch blocks');
            reject(error);
            return;
          }
          let len = blocks.length;
          let totalTime = 0;
          let cnt = 0;
          for (cnt = 0; cnt < len; cnt++) {
            if (cnt === 0) {
              continue;
            }
            let currentBlock = blocks[cnt];
            let prevBlock = blocks[cnt - 1];
            totalTime = totalTime + Number(currentBlock.timestamp) - Number(prevBlock.timestamp);
          }
          let avgTime = Math.ceil(totalTime / (len - 1));
          resolve({
            currentBlockNumber: currentBlockNumber,
            averageBlockGenerationTime: avgTime,
            totalTime: totalTime,
            blocks: blocks
          });
          return;
        };

        //Fetch the blocks.

        let batch = new web3.BatchRequest();
        let isCalculatorScheduled = false;
        console.log('Building batch request');
        for (let cnt = 0; cnt < totalBlocksToFetch; cnt++) {
          let blockNum = startBlock + cnt;
          let _request = web3.eth.getBlock.request(blockNum);
          _request.callback = function(err, block) {
            if (block) {
              blocks.push(block);
            }
            if (!isCalculatorScheduled) {
              //We have received batch response.
              //Schedule the time calculator.
              setTimeout(calculator, 0);
              isCalculatorScheduled = true;
            }
          };
          batch.add(_request);
        }
        batch.execute();
      });

      return calculatorPromise;
    });
  }

  static get DEFAULT_CONFIRMATIONS() {
    return 24;
  }
}

module.exports = Anchor;
