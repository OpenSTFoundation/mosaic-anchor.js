'use strict';

const Web3 = require('web3');
const Web3PromiEvent = require('web3-core-promievent');
const Anchor = require('../libs/Anchor');

const DEFAULT_CONFIRMATIONS = 24;
const DEFAULT_COLLATE = 5;
const DEFAULT_ITERATIONS = 10;
const MIN_BLOCK_GENERATION_TIME = 1000;

class Job {
  constructor(sourceWeb3, destinationWeb3, address, worker, confirmations, txOptions) {
    const oThis = this;

    oThis.sourceWeb3 = sourceWeb3;
    oThis.destinationWeb3 = destinationWeb3;
    oThis.address = address;
    oThis.worker = worker;
    oThis.txOptions = txOptions;
    oThis.confirmations = confirmations || DEFAULT_CONFIRMATIONS;
    oThis.promieEvent = null;
    oThis.isExecuting = null;
    oThis.anchor = new Anchor(sourceWeb3, destinationWeb3, address, worker, confirmations, txOptions);
  }

  execute(collate, iterations) {
    const oThis = this;

    if (oThis.isExecuting) {
      return Promise.reject('Job is already executing. Create a new job.');
    }
    oThis.isExecuting = true;

    let promieEvent = (oThis.promieEvent = Web3PromiEvent());

    collate = collate || DEFAULT_COLLATE;
    oThis.iterations = iterations || DEFAULT_ITERATIONS;
    oThis.latestBlockHeight = null;
    oThis.pollingInterval = MIN_BLOCK_GENERATION_TIME;

    //Validate the anchor
    oThis.anchor
      .validate()
      .then(function() {
        console.log('* Getting last commited block height');
        return oThis.anchor.getLatestStateRootBlockHeight().then(function(latestBlockHeight) {
          oThis.latestBlockHeight = Number(latestBlockHeight);
          console.log('\t - latest Block Height:', latestBlockHeight);
        });
      })
      .then(function() {
        console.log('* Computing avg. block generation time of source chain');
        return oThis.anchor.getSourceAverageBlockGenerationTime().then(function(blockGenerationInfo) {
          console.log('\t - blockGenerationInfo:\n\x1b[2m', JSON.stringify(blockGenerationInfo), '\x1b[0m\n');

          //Set polling time.
          let blockGenerationTime = blockGenerationInfo.averageBlockGenerationTime;
          oThis.pollingInterval = collate * Math.max(blockGenerationTime, MIN_BLOCK_GENERATION_TIME);
          console.log('\t - polling interval set to:', oThis.pollingInterval);
        });
      })
      .then(function() {
        oThis.poll();
      })
      .catch(function(error) {
        oThis.isExecuting = false;
        //Something went wrong. Forward all errors.
        promieEvent.reject(error);
      });

    return promieEvent.eventEmitter;
  }

  poll() {
    const oThis = this;
    //1. Fetch current block.
    oThis.anchor
      .getSourceBlock()
      .then(function(block) {
        let blockNumber = Number(block.number);
        //Can we commit this block?
        if (oThis.latestBlockHeight < blockNumber) {
          return oThis.anchor.commitStateRoot(block).then(function(receipt) {
            //Reduce the oThis.iterations.
            oThis.iterations--;
            oThis.latestBlockHeight = blockNumber;
            oThis.promieEvent.eventEmitter.emit('StateRootAvailable', receipt);
          });
        } else {
          console.log(
            '\t - block number',
            blockNumber,
            'can not be commited yet. latestBlockHeight',
            oThis.latestBlockHeight
          );
        }
      })
      .then(function() {
        if (oThis.iterations) {
          console.log('We should do more iterations. oThis.iterations', oThis.iterations);
          //We should do more iterations.
          setTimeout(function() {
            oThis.poll();
          }, oThis.pollingInterval);
        } else {
          //No more iterations needed.
          oThis.isExecuting = false;
          console.log('Resolving promieEvent. oThis.iterations', oThis.iterations);
          oThis.promieEvent.resolve();
        }
      })
      .catch(function(error) {
        oThis.isExecuting = false;
        //Something went wrong. Forward all errors.
        oThis.promieEvent.reject(error);
      });
  }

  getSourceWeb3() {
    return this.sourceWeb3;
  }

  getDestinationWeb3Web3() {
    return this.destinationWeb3;
  }
}

module.exports = Job;
