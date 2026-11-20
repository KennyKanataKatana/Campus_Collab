require('dotenv').config({
    path: '.env.test',
    override: true
});

const { execSync } = require('child_process');

console.log("DATABASE_URL:", process.env.DATABASE_URL);
module.exports = async () => {
  console.log('Running database reset for integration tests...');
  execSync('node scripts/reset.js', { stdio: 'inherit', env: process.env });
};
  