# mosaic-anchor.js
Mosaic Anchor enables committing state-roots of complimentary chain. 


## Installation

### Node.js

```bash
npm install mosaic-anchor.js
```

### Creating a Job
```js
  const MosaicAnchor = require('mosaic-anchor.js');
  let sourceWeb3 = new Web3('http://....');
  let destinationWeb3 = new Web3('http://....');;
  let address = "0x...";
  let worker = "0x...";
  let confirmations = 1;
  let oJob = new Package.Job(sourceWeb3, destinationWeb3, address, worker, confirmations);
```

Make sure to add worker key has sufficient gas and is added to **web3.eth.accounts.wallet**.

### Executing the job
```js
oJob.execute().on('StateRootAvailable', function ( receipt ) {
  
}).then(function () {
  console.log('Job done..');
}).catch(function ( error ) {
  console.log("Something went wrong.", error);
})
```

For complete anchor setups, create 2 instances of Job.
