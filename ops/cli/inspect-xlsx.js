// READ-ONLY structural inspector for the source Excel files.
// Dumps each workbook's sheets + the first rows of each, so we can see the exact
// layout (headers, dimensions, wide vs long, codes/labels, units, time) before any mapping.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const MAXR = parseInt(process.argv[3] || '14', 10);
const files = fs.readdirSync(dir).filter(f => /\.xlsx?$/i.test(f));

for (const f of files) {
  console.log('\n\n################################################################');
  console.log('FILE:', f);
  console.log('################################################################');
  let wb;
  try { wb = XLSX.readFile(path.join(dir, f), { cellDates: true }); }
  catch (e) { console.log('  READ ERROR:', e.message); continue; }
  console.log('SHEETS (' + wb.SheetNames.length + '):', wb.SheetNames.join(' | '));
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    if (!ws || !ws['!ref']) { console.log(`\n--- "${sn}": EMPTY ---`); continue; }
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
    const merges = (ws['!merges'] || []).length;
    console.log(`\n--- Sheet "${sn}"  range=${ws['!ref']}  rows=${rows.length}  merges=${merges} ---`);
    rows.slice(0, MAXR).forEach((r, i) => {
      const cells = r.slice(0, 14).map(c => {
        const s = (c instanceof Date) ? c.toISOString().slice(0, 10) : String(c);
        return s.length > 22 ? s.slice(0, 22) + '…' : s;
      });
      console.log(`r${String(i).padStart(2)}: ${cells.join(' | ')}`);
    });
    if (rows.length > MAXR) console.log(`     … +${rows.length - MAXR} more rows`);
  }
}
