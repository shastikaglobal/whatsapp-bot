import pool from '../config/db.js';

export const getProducts = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, category, description, price, moq, availability, shippinginfo as "shippingInfo", created_at, updated_at FROM products ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, category, description, price, moq, availability, shippinginfo as "shippingInfo", created_at, updated_at FROM products WHERE id = $1',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createProduct = async (req, res) => {
  const { id, name, category, description, price, moq, availability, shippingInfo } = req.body;
  try {
    await pool.query(
      'INSERT INTO products (id, name, category, description, price, moq, availability, shippingInfo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, name, category, description, price, moq, availability, shippingInfo]
    );
    res.status(201).json({ message: 'Product created successfully', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProduct = async (req, res) => {
  const { name, category, description, price, moq, availability, shippingInfo } = req.body;
  try {
    await pool.query(
      'UPDATE products SET name = $1, category = $2, description = $3, price = $4, moq = $5, availability = $6, shippingInfo = $7 WHERE id = $8',
      [name, category, description, price, moq, availability, shippingInfo, req.params.id]
    );
    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportProductsCSV = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, category, description, price, moq, availability, shippinginfo FROM products ORDER BY name ASC'
    );

    const headers = ['id', 'name', 'category', 'description', 'price', 'moq', 'availability', 'shippinginfo'];
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvLines = [headers.join(',')];
    for (const r of rows) {
      csvLines.push([
        escapeCsv(r.id),
        escapeCsv(r.name),
        escapeCsv(r.category),
        escapeCsv(r.description),
        (r.price !== null && r.price !== undefined && !isNaN(parseFloat(r.price))) ? parseFloat(r.price) : '',
        escapeCsv(r.moq),
        escapeCsv(r.availability),
        escapeCsv(r.shippinginfo)
      ].join(','));
    }

    const csvContent = csvLines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="shastika_products.csv"');
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('exportProductsCSV error:', error.message);
    res.status(500).json({ error: 'Failed to export products to CSV' });
  }
};

// Helper: parse CSV lines according to RFC 4180
const parseCsvLine = (line) => {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
};

// Helper: inspect products.id column type
const getProductsIdType = async () => {
  try {
    const { rows } = await pool.query(
      "SELECT data_type FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'id'"
    );
    return (rows[0]?.data_type || 'character varying').toLowerCase();
  } catch (_) {
    return 'character varying';
  }
};

// Helper: inspect whether products has an updated_at column
export const checkProductsUpdatedAt = async () => {
  try {
    const { rows } = await pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'updated_at'"
    );
    return rows.length > 0;
  } catch (_) {
    return false;
  }
};

export const previewImportCSV = async (req, res) => {
  try {
    const { csvText } = req.body || {};
    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ error: 'No CSV data provided' });
    }

    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length <= 1) {
      return res.status(400).json({ error: 'CSV file contains no product data rows.' });
    }

    const headers = parseCsvLine(lines[0]).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
    const nameIdx = headers.indexOf('name');
    const catIdx = headers.indexOf('category');
    const descIdx = headers.indexOf('description');
    const priceIdx = headers.indexOf('price');
    const moqIdx = headers.indexOf('moq');
    const availIdx = headers.indexOf('availability');
    const shipIdx = headers.findIndex(h => h === 'shippinginfo' || h.includes('ship'));
    const idIdx = headers.indexOf('id');

    if (nameIdx === -1) {
      return res.status(400).json({ error: 'CSV missing required "name" header column.' });
    }

    const { rows: existingProducts } = await pool.query('SELECT id, name FROM products');
    const existingById = new Map();
    const existingByName = new Map();
    existingProducts.forEach(p => {
      existingById.set(String(p.id).trim(), p);
      existingByName.set(String(p.name).trim().toLowerCase(), p);
    });

    const previewRows = [];
    const errors = [];
    let toAdd = 0;
    let toUpdate = 0;
    let toSkip = 0;

    for (let i = 1; i < lines.length; i++) {
      const lineNum = i + 1;
      const cols = parseCsvLine(lines[i]);
      const rawName = cols[nameIdx];

      if (!rawName || !rawName.trim()) {
        errors.push(`Row ${lineNum}: Missing product name`);
        toSkip++;
        continue;
      }

      const name = rawName.trim();
      const rawId = (idIdx !== -1 && cols[idIdx]) ? cols[idIdx].trim() : null;
      const category = (catIdx !== -1 && cols[catIdx]) ? cols[catIdx].trim() : null;
      const description = (descIdx !== -1 && cols[descIdx]) ? cols[descIdx].trim() : null;
      
      let price = null;
      if (priceIdx !== -1 && cols[priceIdx] && cols[priceIdx].trim().length > 0) {
        const parsedPrice = parseFloat(cols[priceIdx].trim());
        if (!isNaN(parsedPrice)) {
          price = parsedPrice;
        } else {
          errors.push(`Row ${lineNum} (${name}): Invalid price "${cols[priceIdx]}" (set to NULL)`);
        }
      }

      const moq = (moqIdx !== -1 && cols[moqIdx]) ? cols[moqIdx].trim() : null;
      const availability = (availIdx !== -1 && cols[availIdx]) ? cols[availIdx].trim() : null;
      const shippinginfo = (shipIdx !== -1 && cols[shipIdx]) ? cols[shipIdx].trim() : null;

      // Determine action
      let action = 'add';
      let matchedExisting = null;
      if (rawId && existingById.has(rawId)) {
        action = 'update';
        matchedExisting = existingById.get(rawId);
      } else if (!rawId && existingByName.has(name.toLowerCase())) {
        action = 'update';
        matchedExisting = existingByName.get(name.toLowerCase());
      }

      if (action === 'add') toAdd++;
      if (action === 'update') toUpdate++;

      previewRows.push({
        rowNumber: lineNum,
        action,
        id: matchedExisting ? matchedExisting.id : rawId,
        name,
        category: category || null,
        description: description || null,
        price,
        moq: moq || null,
        availability: availability || null,
        shippinginfo: shippinginfo || null
      });
    }

    res.json({
      success: true,
      summary: {
        totalRows: lines.length - 1,
        toAdd,
        toUpdate,
        toSkip,
        errorCount: errors.length
      },
      errors,
      previewRows
    });
  } catch (error) {
    console.error('previewImportCSV error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const importProductsCSV = async (req, res) => {
  try {
    const { csvText, confirmedRows } = req.body || {};
    let rowsToSave = [];

    if (Array.isArray(confirmedRows) && confirmedRows.length > 0) {
      rowsToSave = confirmedRows;
    } else if (csvText && typeof csvText === 'string') {
      const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length <= 1) {
        return res.status(400).json({ error: 'CSV file contains no product data rows.' });
      }

      const headers = parseCsvLine(lines[0]).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
      const nameIdx = headers.indexOf('name');
      const catIdx = headers.indexOf('category');
      const descIdx = headers.indexOf('description');
      const priceIdx = headers.indexOf('price');
      const moqIdx = headers.indexOf('moq');
      const availIdx = headers.indexOf('availability');
      const shipIdx = headers.findIndex(h => h === 'shippinginfo' || h.includes('ship'));
      const idIdx = headers.indexOf('id');

      if (nameIdx === -1) {
        return res.status(400).json({ error: 'CSV missing required "name" header column.' });
      }

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const name = cols[nameIdx]?.trim();
        if (!name) continue;

        let price = null;
        if (priceIdx !== -1 && cols[priceIdx] && cols[priceIdx].trim().length > 0) {
          const parsedPrice = parseFloat(cols[priceIdx].trim());
          if (!isNaN(parsedPrice)) price = parsedPrice;
        }

        rowsToSave.push({
          id: (idIdx !== -1 && cols[idIdx]) ? cols[idIdx].trim() : null,
          name,
          category: (catIdx !== -1 && cols[catIdx]) ? cols[catIdx].trim() : null,
          description: (descIdx !== -1 && cols[descIdx]) ? cols[descIdx].trim() : null,
          price,
          moq: (moqIdx !== -1 && cols[moqIdx]) ? cols[moqIdx].trim() : null,
          availability: (availIdx !== -1 && cols[availIdx]) ? cols[availIdx].trim() : null,
          shippinginfo: (shipIdx !== -1 && cols[shipIdx]) ? cols[shipIdx].trim() : null
        });
      }
    } else {
      return res.status(400).json({ error: 'No CSV data provided' });
    }

    if (rowsToSave.length === 0) {
      return res.status(400).json({ error: 'No valid product rows to import.' });
    }

    const idType = await getProductsIdType();
    const isIntegerId = idType.includes('int');
    const hasUpdatedAt = await checkProductsUpdatedAt();
    const updateClause = hasUpdatedAt ? ', updated_at = CURRENT_TIMESTAMP' : '';

    let savedCount = 0;
    for (const p of rowsToSave) {
      if (isIntegerId) {
        const intId = p.id ? parseInt(p.id, 10) : NaN;
        if (!isNaN(intId)) {
          // Upsert with integer ID
          await pool.query(
            `INSERT INTO products (id, name, category, description, price, moq, availability, shippinginfo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               category = EXCLUDED.category,
               description = EXCLUDED.description,
               price = EXCLUDED.price,
               moq = EXCLUDED.moq,
               availability = EXCLUDED.availability,
               shippinginfo = EXCLUDED.shippinginfo${updateClause}`,
            [intId, p.name, p.category, p.description, p.price, p.moq, p.availability, p.shippinginfo]
          );
        } else {
          // New product without integer ID: let SERIAL generate sequence
          await pool.query(
            `INSERT INTO products (name, category, description, price, moq, availability, shippinginfo)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [p.name, p.category, p.description, p.price, p.moq, p.availability, p.shippinginfo]
          );
        }
      } else {
        // String/UUID/VARCHAR ID
        const strId = p.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await pool.query(
          `INSERT INTO products (id, name, category, description, price, moq, availability, shippinginfo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             category = EXCLUDED.category,
             description = EXCLUDED.description,
             price = EXCLUDED.price,
             moq = EXCLUDED.moq,
             availability = EXCLUDED.availability,
             shippinginfo = EXCLUDED.shippinginfo${updateClause}`,
          [strId, p.name, p.category, p.description, p.price, p.moq, p.availability, p.shippinginfo]
        );
      }
      savedCount++;
    }

    res.json({
      success: true,
      count: savedCount,
      message: `Successfully imported/updated ${savedCount} product(s).`
    });
  } catch (error) {
    console.error('importProductsCSV error:', error.message);
    res.status(500).json({ error: error.message });
  }
};
