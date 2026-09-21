const { randomBytes } = require('crypto');

console.log('Paste these into your .env (keep them secret, never commit them):\n');
console.log(`JWT_ACCESS_SECRET=${randomBytes(32).toString('hex')}`);
console.log(`JWT_REFRESH_SECRET=${randomBytes(32).toString('hex')}`);
