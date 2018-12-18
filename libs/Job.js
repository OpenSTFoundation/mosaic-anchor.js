'use strict';

const Web3 = require('web3');
const Web3PromiEvent = require('web3-core-promievent');
const Anchor = require('../libs/Anchor');

const DEFAULT_CONFIRMATIONS = 24;
const DEFAULT_COLLATE = 5;
const DEFAULT_ITERATIONS = 10;
const DEFAULT_ANCHOR_INTERVAL = 1000;

class Job {
  constructor(sourceWeb3, destinationWeb3, address, organization, confirmations, anchorInterval, txOptions) {
    const oThis = this;

    oThis.sourceWeb3 = sourceWeb3;
    oThis.destinationWeb3 = destinationWeb3;
    oThis.address = address;
    oThis.organization = organization;
    oThis.txOptions = txOptions;
    oThis.confirmations = confirmations || DEFAULT_CONFIRMATIONS;
    oThis.anchorInterval = anchorInterval || DEFAULT_ANCHOR_INTERVAL;
    oThis.promieEvent = null;
    oThis.isExecuting = null;
    oThis.anchor = new Anchor(sourceWeb3, destinationWeb3, address, organization, confirmations, txOptions);
  }

  execute(iterations) {
    const oThis = this;

    if (oThis.isExecuting) {
      return Promise.reject('Job is already executing. Create a new job.');
    }
    oThis.isExecuting = true;

    let promieEvent = (oThis.promieEvent = Web3PromiEvent());

    oThis.iterations = iterations || DEFAULT_ITERATIONS;
    oThis.latestBlockHeight = null;

    //Validate the anchor
    oThis.anchor
      .validate()
      .then(function() {
        console.log('* Getting last commited block height');
        return oThis.anchor.getLatestStateRootBlockHeight().then(function(latestBlockHeight) {
          oThis.latestBlockHeight = Number(latestBlockHeight);
          console.log('\t - latest Block Height:', latestBlockHeight);
          oThis.poll();
        });
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
          return oThis.anchor.anchorStateRoot(block).then(function(receipt) {
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
          }, oThis.anchorInterval);
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

  static getAverageBlockGenerationInfo(web3, noOfBlocks, confirmations) {
    confirmations = confirmations || DEFAULT_CONFIRMATIONS;
    noOfBlocks = noOfBlocks || DEFAULT_CONFIRMATIONS * 2;

    return web3.eth.getBlockNumber().then(function(currentBlockNumber) {
      currentBlockNumber = Number(currentBlockNumber);

      let endBlock = currentBlockNumber - confirmations;
      let startBlock = endBlock - noOfBlocks;

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
        for (let cnt = 0; cnt < noOfBlocks; cnt++) {
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
}

module.exports = Job;
