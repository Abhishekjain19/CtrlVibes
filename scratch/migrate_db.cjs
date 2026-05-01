const https = require('https');

const data = JSON.stringify({
  query: "ALTER TABLE listings ADD COLUMN IF NOT EXISTS barcode text, ADD COLUMN IF NOT EXISTS category text;"
});

const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: '/v1/projects/dvdolrpnficncqdpduxs/database/query',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sbp_266f39d58ac1cc57f725996e13d207a8ad18b6cc',
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => {
    console.log(body);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(e);
  process.exit(1);
});

req.write(data);
req.end();
