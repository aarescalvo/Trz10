/**
 * Extract romaneo data from RINDE FAENA BOVINO.xlsx for tropas 106-172
 * 
 * Layout B (T 106-T151): data from row 22
 * Layout C (T 152-T172): data from row 24
 * 
 * Some sheets (e.g. T 129) have all columns shifted 1 to the right.
 * This script detects column positions dynamically from the header row.
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// ─── Configuration ──────────────────────────────────────────────────────
const EXCEL_PATH = path.resolve(__dirname, '../docs/importacion/RINDE FAENA BOVINO.xlsx');
const OUTPUT_PATH = path.resolve(__dirname, '../prisma/seed-data/romaneos-t106-t172.json');
const TROPA_START = 106;
const TROPA_END = 172;

// ─── Raza mapping ───────────────────────────────────────────────────────
const RAZA_MAP = {
  'CA': 'CARETA',
  'HE': 'HEREFORD',
  'AA': 'ANGUS',
  'HO': 'HOLANDO',
  'BN': 'BRAHMAN',
  'BS': 'BRANGUS',
  'CH': 'CHAROLAIS',
  // Truncated variants seen in the Excel
  'A':  'ANGUS',
  'C':  'CARETA',
  'BR': 'BRANGUS',
};

// ─── Helper: Excel serial date → YYYY-MM-DD ─────────────────────────────
function excelSerialToDate(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const utcDays = Math.floor(serial - 25569);
  const ms = utcDays * 86400 * 1000;
  const date = new Date(ms);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Helper: Extract tipoAnimal from TIPO DE ANIMAL column ──────────────
function extractTipoAnimal(tipoRaw, clasificacion) {
  if (!tipoRaw && !clasificacion) return null;
  
  if (tipoRaw) {
    const s = String(tipoRaw).trim();
    // Try to extract code from format like "2D - VQ", "2D - NT", "TD - VQ", etc.
    const match = s.match(/[-–]\s*([A-Z]{2,3})\s*$/);
    if (match) return match[1];
    // If it's already a short code like "VQ", "NT", "MEJ"
    if (/^[A-Z]{2,3}$/.test(s)) return s;
  }
  
  // Fallback to clasificacion column
  if (clasificacion) {
    const c = String(clasificacion).trim();
    if (/^[A-Z]{2,3}$/.test(c)) return c;
  }
  
  return null;
}

// ─── Helper: Map raza code to full name ─────────────────────────────────
function mapRaza(code) {
  if (!code) return null;
  const upper = String(code).trim().toUpperCase();
  // If raza contains digits, it's garbage data (e.g. T 138 has animal numbers in raza column)
  if (/\d/.test(upper)) return 'SIN_RAZA';
  return RAZA_MAP[upper] || upper;
}

// ─── Detect column positions from header row ────────────────────────────
// Returns the offset of the GARRON column (normally 1, or 2 if shifted)
function detectGarronOffset(data, headerRow) {
  const row = data[headerRow];
  if (!row) return 1; // default
  
  for (let c = 0; c < Math.min(row.length, 5); c++) {
    const val = String(row[c] || '').replace(/[\r\n]/g, '').trim();
    if (val.includes('GARRON')) return c;
  }
  return 1; // default fallback
}

// ─── Extract fecha faena by scanning metadata area ──────────────────────
function extractFecha(data, scanStartRow, scanEndRow) {
  for (let r = scanStartRow; r <= scanEndRow; r++) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').replace(/[\r\n]/g, '').trim();
      if (val === 'Fecha Faena:' || val.toLowerCase().includes('fecha faena')) {
        // Value should be in the next column
        const raw = row[c + 1];
        if (typeof raw === 'number') {
          const d = excelSerialToDate(raw);
          if (d) return d;
        }
      }
    }
  }
  return null;
}

// ─── Get layout config based on tropa number ────────────────────────────
function getLayout(tropaNumero) {
  if (tropaNumero >= 106 && tropaNumero <= 151) {
    return {
      type: 'B',
      headerRow: 20,
      dataStartRow: 22,
      fechaScanStart: 9,
      fechaScanEnd: 13,
    };
  }
  if (tropaNumero >= 152 && tropaNumero <= 172) {
    return {
      type: 'C',
      headerRow: 22,
      dataStartRow: 24,
      fechaScanStart: 11,
      fechaScanEnd: 15,
    };
  }
  return null;
}

// ─── Main extraction ────────────────────────────────────────────────────
function main() {
  console.log('Loading workbook:', EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH);
  
  const allRomaneos = [];
  const tropaStats = {}; // tropaNumero → count
  const issues = [];
  const tropasWithZeroAnimals = [];
  
  for (let t = TROPA_START; t <= TROPA_END; t++) {
    const sheetName = `T ${t}`;
    const ws = wb.Sheets[sheetName];
    
    if (!ws) {
      issues.push(`Sheet "${sheetName}" not found`);
      tropasWithZeroAnimals.push(t);
      tropaStats[t] = 0;
      continue;
    }
    
    const layout = getLayout(t);
    if (!layout) {
      issues.push(`No layout defined for tropa ${t}`);
      continue;
    }
    
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    
    // ── Detect column offset from header row ──
    const garronOffset = detectGarronOffset(data, layout.headerRow);
    // Column positions relative to garronOffset:
    //   garronOffset + 0 = GARRON
    //   garronOffset + 1 = ANIMAL
    //   garronOffset + 2 = RAZA
    //   garronOffset + 3 = TIPO DE ANIMAL
    //   garronOffset + 4 = CLASIFICACION
    //   garronOffset + 5 = Nº CARAVANA
    //   garronOffset + 6 = KG ENTRADA
    //   garronOffset + 7 = KG 1/2 A
    //   garronOffset + 8 = KG 1/2 B
    //   garronOffset + 9 = TOTAL KG
    //   garronOffset + 10 = RINDE FAENA
    
    if (garronOffset !== 1) {
      issues.push(`T ${t}: Shifted layout detected (garron at index ${garronOffset})`);
    }
    
    // ── Extract fecha faena ──
    const fecha = extractFecha(data, layout.fechaScanStart, layout.fechaScanEnd);
    
    if (!fecha) {
      issues.push(`T ${t}: Could not extract fecha faena (scanned rows ${layout.fechaScanStart}-${layout.fechaScanEnd})`);
    }
    
    const tropaCodigo = `B 2026 ${String(t).padStart(4, '0')}`;
    let animalCount = 0;
    
    // ── Read data rows ──
    for (let r = layout.dataStartRow; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length < (garronOffset + 11)) continue;
      
      const garron = row[garronOffset];
      if (garron === '' || garron === null || garron === undefined || garron === 0) continue;
      
      const garronNum = typeof garron === 'number' ? garron : parseInt(garron, 10);
      if (isNaN(garronNum) || garronNum === 0) continue;
      
      const animalNumero = typeof row[garronOffset + 1] === 'number' ? row[garronOffset + 1] : parseInt(row[garronOffset + 1], 10);
      const raza = mapRaza(row[garronOffset + 2]);
      const tipoAnimal = extractTipoAnimal(row[garronOffset + 3], row[garronOffset + 4]);
      const caravana = String(row[garronOffset + 5] || '').trim();
      const pesoVivo = typeof row[garronOffset + 6] === 'number' ? row[garronOffset + 6] : parseFloat(row[garronOffset + 6]) || 0;
      const kgMediaIzq = typeof row[garronOffset + 7] === 'number' ? row[garronOffset + 7] : parseFloat(row[garronOffset + 7]) || 0;
      const kgMediaDer = typeof row[garronOffset + 8] === 'number' ? row[garronOffset + 8] : parseFloat(row[garronOffset + 8]) || 0;
      const pesoTotal = typeof row[garronOffset + 9] === 'number' ? row[garronOffset + 9] : parseFloat(row[garronOffset + 9]) || 0;
      const rinde = typeof row[garronOffset + 10] === 'number' ? row[garronOffset + 10] : parseFloat(row[garronOffset + 10]) || 0;
      
      // Skip rows with no pesoVivo (likely empty/template rows)
      if (pesoVivo === 0 && kgMediaIzq === 0 && kgMediaDer === 0) continue;
      
      animalCount++;
      
      const romaneo = {
        tropaNumero: t,
        animalNumero: isNaN(animalNumero) ? animalCount : animalNumero,
        garron: garronNum,
        tropaCodigo: tropaCodigo,
        tipoAnimal: tipoAnimal || 'SIN_TIPO',
        raza: raza || 'SIN_RAZA',
        pesoVivo: pesoVivo,
        kgMediaIzq: Math.round(kgMediaIzq * 100) / 100,
        kgMediaDer: Math.round(kgMediaDer * 100) / 100,
        pesoTotal: Math.round(pesoTotal * 100) / 100,
        rinde: rinde,
        fecha: fecha || `2026-01-01`,
        estado: 'CONFIRMADO',
      };
      
      // Add caravana only if present and not S/C
      if (caravana && caravana !== '' && caravana !== 'S/C') {
        romaneo.caravana = caravana;
      }
      
      allRomaneos.push(romaneo);
    }
    
    tropaStats[t] = animalCount;
    
    if (animalCount === 0) {
      tropasWithZeroAnimals.push(t);
      issues.push(`T ${t}: No animals extracted (layout: ${layout.type}, garronOffset: ${garronOffset}, data rows: ${layout.dataStartRow}-${data.length})`);
    }
  }
  
  // ── Write output ──
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allRomaneos, null, 2), 'utf-8');
  
  // ── Print summary ──
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  EXTRACTION SUMMARY: Tropas ' + TROPA_START + ' - ' + TROPA_END);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Output file: ' + OUTPUT_PATH);
  console.log('  Total romaneos extracted: ' + allRomaneos.length);
  console.log('  Total tropas processed: ' + (TROPA_END - TROPA_START + 1));
  console.log('  Tropas with 0 animals: ' + tropasWithZeroAnimals.length);
  
  if (tropasWithZeroAnimals.length > 0) {
    console.log('  Empty tropas: ' + tropasWithZeroAnimals.join(', '));
  }
  
  // Per-tropa breakdown
  console.log('\n  ─── Per-tropa breakdown ───');
  const tropaNumbers = Object.keys(tropaStats).map(Number).sort((a, b) => a - b);
  for (const tn of tropaNumbers) {
    const layout = getLayout(tn);
    const label = layout ? layout.type : '?';
    console.log('  T ' + String(tn).padStart(3, ' ') + ' (' + label + '): ' + String(tropaStats[tn]).padStart(3, ' ') + ' animales');
  }
  
  // Stats
  const uniqueTropas = new Set(allRomaneos.map(r => r.tropaNumero)).size;
  const avgAnimales = (allRomaneos.length / uniqueTropas).toFixed(1);
  
  console.log('\n  ─── Statistics ───');
  console.log('  Unique tropas with data: ' + uniqueTropas);
  console.log('  Average animals per tropa: ' + avgAnimales);
  
  // Raza distribution
  const razaCounts = {};
  for (const r of allRomaneos) {
    razaCounts[r.raza] = (razaCounts[r.raza] || 0) + 1;
  }
  console.log('\n  ─── Raza distribution ───');
  for (const [raza, count] of Object.entries(razaCounts).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + raza.padEnd(15) + ': ' + count);
  }
  
  // Tipo animal distribution
  const tipoCounts = {};
  for (const r of allRomaneos) {
    tipoCounts[r.tipoAnimal] = (tipoCounts[r.tipoAnimal] || 0) + 1;
  }
  console.log('\n  ─── Tipo Animal distribution ───');
  for (const [tipo, count] of Object.entries(tipoCounts).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + tipo.padEnd(15) + ': ' + count);
  }
  
  // Fecha range
  const fechas = allRomaneos.map(r => r.fecha).filter(f => f !== '2026-01-01');
  if (fechas.length > 0) {
    fechas.sort();
    console.log('\n  ─── Date range ───');
    console.log('  Earliest: ' + fechas[0]);
    console.log('  Latest:   ' + fechas[fechas.length - 1]);
  }
  
  if (issues.length > 0) {
    console.log('\n  ─── Issues (' + issues.length + ') ───');
    for (const issue of issues) {
      console.log('  ⚠ ' + issue);
    }
  }
  
  console.log('\n  ✅ Extraction complete!\n');
}

main();
