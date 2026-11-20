const { execSync } = require('child_process');

module.exports = async () => {

    console.log('Setting environment to test');


    console.log('Running database reset for test environment...');

    execSync('node scripts/reset.js', {
        stdio: 'inherit',
        env: process.env
    });


    console.log('Seeding test database...');

    execSync('node scripts/seed.js', {
        stdio: 'inherit',
        env: process.env
    });


    console.log('Test database ready.');

};