// Prints two random 64-character secrets you can paste into .env.
// Usage: node scripts/generate-secrets.js
const crypto = require('node:crypto');

console.log('JWT_ACCESS_SECRET=' + crypto.randomBytes(48).toString('base64url'));
console.log('INTERNAL_SERVICE_API_KEY=' + crypto.randomBytes(48).toString('base64url'));
console.log('\nJWT_ACCESS_SECRET must be pasted into BOTH backend/auth-service/.env');
console.log('and backend/employee-service/.env, with the exact same value.');
