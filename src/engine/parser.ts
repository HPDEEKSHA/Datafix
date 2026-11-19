import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  ColumnProfile,
  ColumnSemanticType,
  DatasetRow,
} from './types';

const MISSING_TOKENS = new Set(['', 'na', 'n/a', 'nan', 'null', 'none', 'undefined']);

export function isMissingValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return Number.isNaN(value);
  const str = String(value).trim().toLowerCase();
  return MISSING_TOKENS.has(str);
}

export function parseNumericCandidate(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || isMissingValue(trimmed)) return null;
  // Match standard numbers or currency/comma formatted numbers like "$7,200.00" or "-1,250.5"
  const normalized = trimmed.replace(/[$,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

export function isDateCandidate(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (!s || isMissingValue(s)) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return true;
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) return true;
  if (/^[A-Za-z]{3,9}\s+\d{1,2},\s*\d{4}$/.test(s)) return true;
  return false;
}

function inferColumnType(columnName: string, values: unknown[]): ColumnSemanticType {
  const lowerName = columnName.toLowerCase();
  const nonMissing = values.filter((v) => !isMissingValue(v));
  if (nonMissing.length === 0) return 'text';

  if (lowerName.includes('email') || lowerName.includes('e-mail')) {
    return 'email';
  }
  if (lowerName.includes('phone') || lowerName.includes('mobile') || lowerName.includes('tel')) {
    return 'phone';
  }
  if (lowerName.includes('date') || lowerName.includes('_at') || lowerName.includes('dob')) {
    return 'date';
  }

  let emailHits = 0;
  let phoneHits = 0;
  let dateHits = 0;
  let numberHits = 0;

  for (const val of nonMissing) {
    const str = String(val).trim();
    if (str.includes('@') && /\.[a-z]{2,}$/i.test(str)) {
      emailHits++;
    } else if (/^[\d\s().+-]{7,20}$/.test(str) && str.replace(/\D/g, '').length >= 7 && !/^-?\d+(\.\d+)?$/.test(str)) {
      phoneHits++;
    } else if (isDateCandidate(str)) {
      dateHits++;
    } else if (parseNumericCandidate(val) !== null) {
      numberHits++;
    }
  }

  const ratio = (hits: number) => hits / nonMissing.length;
  if (ratio(emailHits) >= 0.5) return 'email';
  if (ratio(dateHits) >= 0.5) return 'date';
  if (ratio(phoneHits) >= 0.5) return 'phone';
  if (ratio(numberHits) >= 0.65) return 'number';

  const uniqueLower = new Set(nonMissing.map((v) => String(v).trim().toLowerCase()));
  if (
    !lowerName.includes('id') &&
    !lowerName.includes('name') &&
    (uniqueLower.size <= Math.max(8, Math.floor(nonMissing.length * 0.45)))
  ) {
    return 'categorical';
  }

  return 'text';
}

function computeNumericStats(values: number[]) {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0];
  const max = sorted[n - 1];
  const mean = sorted.reduce((acc, v) => acc + v, 0) / n;

  const quantile = (q: number) => {
    const pos = (n - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  };

  const median = quantile(0.5);
  const q1 = quantile(0.25);
  const q3 = quantile(0.75);
  return {
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    q1: Number(q1.toFixed(2)),
    q3: Number(q3.toFixed(2)),
    iqr: Number((q3 - q1).toFixed(2)),
  };
}

export function inferColumnProfiles(rows: DatasetRow[], columns: string[]): ColumnProfile[] {
  return columns.map((col) => {
    const rawValues = rows.map((r) => r[col]);
    const nonEmpty = rawValues.filter((v) => !isMissingValue(v));
    const missingCount = rawValues.length - nonEmpty.length;
    const uniqueValues = new Set(nonEmpty.map((v) => String(v).trim()));
    const inferredType = inferColumnType(col, rawValues);

    let numericStats: ColumnProfile['numericStats'];
    if (inferredType === 'number') {
      const nums = nonEmpty
        .map((v) => parseNumericCandidate(v))
        .filter((n): n is number => n !== null);
      numericStats = computeNumericStats(nums);
    }

    return {
      name: col,
      inferredType,
      nonEmptyCount: nonEmpty.length,
      missingCount,
      uniqueCount: uniqueValues.size,
      sampleValues: Array.from(uniqueValues).slice(0, 4),
      numericStats,
    };
  });
}

export interface ParsedDatasetResult {
  columns: string[];
  rows: DatasetRow[];
  fileFormat: 'csv' | 'xlsx' | 'xls';
}

export function parseDatasetBuffer(buffer: Buffer | Uint8Array, fileName: string): ParsedDatasetResult {
  const lower = fileName.toLowerCase();
  const ext = lower.endsWith('.csv')
    ? 'csv'
    : lower.endsWith('.xlsx')
      ? 'xlsx'
      : lower.endsWith('.xls')
        ? 'xls'
        : null;

  if (!ext) {
    throw new Error('Unsupported file format. Please upload a .csv, .xlsx, or .xls file.');
  }

  if (buffer.byteLength === 0) {
    throw new Error('The uploaded file is empty.');
  }

  if (ext === 'csv') {
    const csvText = Buffer.from(buffer).toString('utf8').replace(/^\uFEFF/, '');
    if (!csvText.trim()) {
      throw new Error('The CSV file contains no data.');
    }

    const parsed = Papa.parse<DatasetRow>(csvText, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      throw new Error(`CSV parsing failed: ${parsed.errors[0].message}`);
    }

    const columns = (parsed.meta.fields ?? []).filter((c) => c.length > 0);
    if (columns.length === 0 || parsed.data.length === 0) {
      throw new Error('The CSV dataset has no valid columns or rows.');
    }

    const normalizedRows: DatasetRow[] = parsed.data.map((row) => {
      const out: DatasetRow = {};
      for (const col of columns) {
        out[col] = row[col] !== undefined ? row[col] : '';
      }
      return out;
    });

    return { columns, rows: normalizedRows, fileFormat: 'csv' };
  }

  // Excel (.xlsx / .xls)
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The Excel workbook contains no sheets.');
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rawObjects = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  if (rawObjects.length === 0) {
    throw new Error('The Excel sheet is empty.');
  }

  const colSet = new Set<string>();
  for (const row of rawObjects) {
    for (const key of Object.keys(row)) {
      const clean = key.trim();
      if (clean) colSet.add(clean);
    }
  }
  const columns = Array.from(colSet);
  if (columns.length === 0) {
    throw new Error('No column headers were found in the Excel sheet.');
  }

  const rows: DatasetRow[] = rawObjects.map((row) => {
    const out: DatasetRow = {};
    for (const col of columns) {
      const val = row[col];
      out[col] = val !== undefined ? (val as string | number | boolean | null) : '';
    }
    return out;
  });

  return { columns, rows, fileFormat: ext };
}

export function serializeToCsv(rows: DatasetRow[], columns: string[]): string {
  const orderedRows = rows.map((row) => {
    const ordered: Record<string, unknown> = {};
    for (const col of columns) {
      const val = row[col];
      ordered[col] = val === null || val === undefined ? '' : val;
    }
    return ordered;
  });
  return Papa.unparse(orderedRows, { columns });
}

export function serializeToXlsxBuffer(rows: DatasetRow[], columns: string[]): Buffer {
  const orderedRows = rows.map((row) => {
    const ordered: Record<string, unknown> = {};
    for (const col of columns) {
      const val = row[col];
      ordered[col] = val === null || val === undefined ? '' : val;
    }
    return ordered;
  });
  const worksheet = XLSX.utils.json_to_sheet(orderedRows, { header: columns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cleaned_Data');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
