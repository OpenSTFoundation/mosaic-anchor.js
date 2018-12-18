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
  let confirmations = 24;
  let anchorInterval = 1 * 60 * 1000; /* 1 minute */
  let oJob = new MosaicAnchor.Job(sourceWeb3, destinationWeb3, address, organization, confirmations, anchorInterval);

  
```
| Parameter | Description |
| ------ | ------ |
| sourceWeb3 | Web3 object connected to source chain whose state needs to be anchored. |
| destinationWeb3 | Web3 object connetced to destination chain where the state-root needs to be anchored. |
| address | Address of Anchor contract.|
| organization  | Address of Organization contract owner. |
| confirmations | Minimum no. of block confirmations needed before anchoring the state-root. |
| anchorInterval | Minimum interval between two anchors. |
| iterations | No. of times state-root should be commited by this job. |

For complete mosaic setup, create 2 instances of Job.
Make sure to add worker key has sufficient gas and is added to **web3.eth.accounts.wallet**.

### Executing the job
```js
let iterations = 10;
oJob.execute( iterations ).on('StateRootAvailable', function ( receipt ) {
  console.log('State root has been anchored. receipt', JSON.stringify(receipt, null, 2));
}).then(function () {
  console.log('Job completed.');
}).catch(function ( error ) {
  console.log("Something went wrong.", error);
})
```

| Parameter | Description |
| ------ | ------ |
| iterations | No. of times state-root should be commited by this job. |




### Advanced Usage - Creating Anchor.
Anchor class gives developers complete control which enables them build their own logic for anchroing state-roots.
```js
  const MosaicAnchor = require('mosaic-anchor.js');
  let sourceWeb3 = new Web3('http://....');
  let destinationWeb3 = new Web3('http://....');;
  let address = "0x...";
  let organization = "0x...";
  let confirmations = 24;
  let oAnchor = new MosaicAnchor.Anchor(sourceWeb3, destinationWeb3, address, organization, confirmations);

  //Validate Anchor Helper
  oAnchor.validate().then(function () {
    console.log('oAnchor is valid');
    //Do your task here.
  }).catch(function ( error ) {
    console.log('oAnchor is invalid. Error:', error);
  })

  //Get last anchored state-root block height
  oAnchor.getLatestStateRootBlockHeight().then(function ( blockHeight ) {
    console.log('blockHeight', blockHeight);
  });

  //Anchor state-root.
  oAnchor.anchorStateRoot();


```
