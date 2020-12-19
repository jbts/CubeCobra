// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const Cube = require('../models/cube');
const carddb = require('../serverjs/cards.js');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const batchSize = 1000;
const folder = 'august2';

const processCube = (cube) => {
  return cube.cards.map((card) => carddb.cardFromId(card.cardID).name_lower);
};

(async () => {
  await carddb.initializeCardDb();
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    // process all cube objects
    console.log('Started');
    const count = await Cube.countDocuments();
    const cursor = Cube.find().lean().cursor();

    // batch them in 100
    for (let i = 0; i < count; i += batchSize) {
      const cubes = [];
      for (let j = 0; j < batchSize; j++) {
        if (i + j < count) {
          // eslint-disable-next-line no-await-in-loop
          const cube = await cursor.next();
          if (cube) {
            cubes.push(cube);
          }
        }
      }

      const params = {
        Bucket: 'cubecobra', // pass your bucket name
        Key: `${folder}/cubes/${i / batchSize}.json`, // file will be saved as testBucket/contacts.csv
        Body: JSON.stringify(cubes.map(processCube)),
      };

      // eslint-disable-next-line no-await-in-loop
      await s3.upload(params).promise();

      console.log(`Finished: ${Math.min(count, i + batchSize)} of ${count} cubes`);
    }
    mongoose.disconnect();
    console.log('done');
  });
})();
