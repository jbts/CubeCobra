const fs = require('fs');
const fetch = require('node-fetch');

const routes = JSON.parse(fs.readFileSync('private/routes.json'));
console.log(routes);

const handleResponse = (res) => {
  console.log(`   ${res.status}`);
};

// const prefix = 'http://localhost:5000';
const prefix = 'https://cubecobra.com';

(async () => {
  for (let i = 0; i < 10; i++) {
    console.log(`Iteration ${i + 1}`);
    for (const route of routes) {
      console.log(`   Fetching ${route}`);

      console.time('    time');
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`${prefix}${route}`);
      console.timeEnd('    time');

      handleResponse(res);
    }
  }
})();
