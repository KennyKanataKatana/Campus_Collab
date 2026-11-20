const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function reset() {
  try {
    console.log('Resetting database...');

    // Read schema.sql
    const schemaPath = path.join(__dirname, '..', 'schema.sql');

    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    await pool.query(schema);

    console.log('Database schema created successfully.');
  } catch (err) {
    console.error('Reset failed:', err);
  } finally {
    await pool.end();
  }
}

reset();
