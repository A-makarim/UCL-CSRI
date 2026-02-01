import fs from 'fs';

const filePath = 'E:/projects/UCL-CSRI/bulk_property_predictions_2028.csv';
const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

let headerFields = null;
let headerBuffer = null;

for (let i = 0; i < lines.length && i < 2000; i += 1) {
  const line = lines[i];
  if (!line || !line.trim()) continue;

  if (!headerFields) {
    if (headerBuffer) {
      const headerLine = `${headerBuffer}${line}`;
      headerBuffer = null;
      const parts = headerLine.split(',').map((value) => value.replace(/"/g, '').trim());
      const hasPred = parts.includes('predicted_price');
      const hasPost = parts.includes('postcode');
      if (hasPred && hasPost) {
        headerFields = parts;
        continue;
      }
    }

    if (line.startsWith('transaction_id') && !line.includes('predicted_price')) {
      headerBuffer = line;
      continue;
    }

    const parts = line.split(',').map((value) => value.replace(/"/g, '').trim());
    const hasPred = parts.includes('predicted_price');
    const hasPost = parts.includes('postcode');
    if (hasPred && hasPost) {
      headerFields = parts;
      continue;
    }

    continue;
  }

  const parts = line.split(',');
  const idxDate = headerFields.indexOf('date_of_transfer');
  const idxYear = headerFields.indexOf('year');
  const dateRaw = (parts[idxDate] || '').trim();
  const yearRaw = (parts[idxYear] || '').trim();

  let date = dateRaw.split(' ')[0];
  if (yearRaw && date.includes('-')) {
    const [_, month, day] = date.split('-');
    date = `${yearRaw}-${month}-${day}`;
  }

  const monthKey = date.substring(0, 7);
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    console.log('badMonth', monthKey);
    console.log('line', line);
    console.log('dateRaw', dateRaw, 'yearRaw', yearRaw, 'idxDate', idxDate, 'idxYear', idxYear);
    break;
  }
}

if (!headerFields) {
  console.log('headerFields not found in first 2000 lines');
} else {
  console.log('headerFields found, length', headerFields.length);
}
