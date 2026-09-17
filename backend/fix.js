import pool from './config/db.js';

async function fix() {
    try {
        const {rows: customers} = await pool.query('SELECT id FROM customers WHERE id NOT IN (SELECT customer_id FROM conversations)');
        for (let c of customers) {
            await pool.query('INSERT INTO conversations (customer_id, status) VALUES ($1, $2)', [c.id, 'open']);
        }
        console.log('Fixed ' + customers.length + ' customers');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
fix();
