import pool from './config/db.js';

async function setup() {
  try {
    // 1. Ensure moq column in products accepts text (e.g. '10 Tons', '1 FCL')
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'products' AND column_name = 'moq' AND data_type = 'integer'
        ) THEN
          ALTER TABLE products ALTER COLUMN moq TYPE VARCHAR(100) USING moq::text;
        END IF;
      END $$;
    `);
    console.log('[Setup] products.moq column checked/updated to VARCHAR(100).');

    // 2. Seed core product auto reply rules if not already present
    const defaultRules = [
      {
        keyword: 'pumpkin',
        reply_text: '🎃 Shastika Global Impex exports premium quality fresh green and yellow pumpkins from Tamil Nadu. Please let us know your required quantity and destination port.'
      },
      {
        keyword: 'coconut',
        reply_text: '🥥 We export fresh mature semi-husked coconuts (550g-650g) in 25kg PP bags. Please share your required volume and destination port.'
      },
      {
        keyword: 'banana',
        reply_text: '🍌 We export fresh G9 Cavendish bananas in 7kg/13kg export cartons. Please let us know your required quantity and discharge port.'
      },
      {
        keyword: 'watermelon',
        reply_text: '🍉 We supply fresh Indian watermelons (Kiran / Namdhari varieties). What quantity and destination port are you looking for?'
      },
      {
        keyword: 'cucumber',
        reply_text: '🥒 We export fresh green crisp cucumbers. Please share your required quantity and packing preferences.'
      }
    ];

    for (const r of defaultRules) {
      const existing = await pool.query(
        'SELECT id FROM auto_reply_rules WHERE LOWER(keyword) = $1',
        [r.keyword.toLowerCase()]
      );
      if (existing.rows.length === 0) {
        await pool.query(
          'INSERT INTO auto_reply_rules (keyword, reply_text, is_active) VALUES ($1, $2, true)',
          [r.keyword, r.reply_text]
        );
        console.log(`[Setup] Added rule for "${r.keyword}"`);
      } else {
        console.log(`[Setup] Rule for "${r.keyword}" already exists.`);
      }
    }
  } catch (err) {
    console.error('[Setup Error]:', err.message);
  } finally {
    await pool.end();
  }
}

setup();

