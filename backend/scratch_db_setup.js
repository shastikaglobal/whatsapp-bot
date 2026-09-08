import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function setupDatabase() {
  const connectionDetails = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 3306,
    multipleStatements: true
  };

  try {
    console.log('Connecting to MySQL...');
    const connection = await mysql.createConnection(connectionDetails);
    
    console.log('Successfully connected to MySQL server.');

    const sqlPath = path.join(process.cwd(), 'database.sql');
    console.log(`Reading SQL from: \${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing database schema...');
    await connection.query(sql);

    console.log('Database and tables created successfully.');
    
    // Check tables
    await connection.query('USE shastika_whatsapp_bot');
    const [tables] = await connection.query('SHOW TABLES');
    console.log('Tables in shastika_whatsapp_bot:');
    tables.forEach(row => {
      console.log(`- \${Object.values(row)[0]}`);
    });

    await connection.end();
  } catch (err) {
    console.error('Database setup failed:', err.message);
    process.exit(1);
  }
}

setupDatabase();
