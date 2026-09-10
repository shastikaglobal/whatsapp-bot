import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dirsToProcess = [
  path.join(__dirname, 'controllers'),
  path.join(__dirname, 'services')
];

function convertQuery(content) {
  // Replace array destructuring for pool.query results
  // e.g. const [rows] = await pool.query(...) -> const { rows } = await pool.query(...)
  content = content.replace(/const\s+\[\s*([a-zA-Z0-9_]+)\s*\]\s*=\s*await\s+pool\.query/g, 'const { rows: $1 } = await pool.query');

  // Replace ER_DUP_ENTRY with 23505
  content = content.replace(/ER_DUP_ENTRY/g, '23505');

  // Replace parameter placeholders (?) with $1, $2...
  let offset = 0;
  while (true) {
    const idx = content.indexOf('pool.query(', offset);
    if (idx === -1) break;
    
    // Find the string literal used in pool.query (could be ' or `)
    const quoteMatches = [];
    let singleQuote = content.indexOf("'", idx);
    if (singleQuote !== -1) quoteMatches.push({ type: "'", idx: singleQuote });
    let backtick = content.indexOf('`', idx);
    if (backtick !== -1) quoteMatches.push({ type: '`', idx: backtick });

    quoteMatches.sort((a, b) => a.idx - b.idx);
    
    if (quoteMatches.length > 0 && quoteMatches[0].idx < idx + 50) {
      const startQuoteIdx = quoteMatches[0].idx;
      const quoteChar = quoteMatches[0].type;
      const endQuoteIdx = content.indexOf(quoteChar, startQuoteIdx + 1);
      
      if (endQuoteIdx !== -1) {
        let queryStr = content.substring(startQuoteIdx, endQuoteIdx + 1);
        
        let paramCounter = 1;
        queryStr = queryStr.replace(/\?/g, () => `$${paramCounter++}`);
        
        content = content.substring(0, startQuoteIdx) + queryStr + content.substring(endQuoteIdx + 1);
        offset = startQuoteIdx + queryStr.length;
      } else {
         offset = idx + 10;
      }
    } else {
      offset = idx + 10;
    }
  }
  
  return content;
}

for (const dir of dirsToProcess) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.js')) {
      const filePath = path.join(dir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      const original = content;
      content = convertQuery(content);
      
      if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${file}`);
      }
    }
  }
}
