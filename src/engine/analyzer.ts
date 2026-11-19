import {
  inferColumnProfiles,
  isMissingValue,
  parseNumericCandidate,
} from './parser';
import {
  AnalysisResult,
  AuditLogEntry,
  CategoryCount,
  ColumnMissingCount,
  ColumnProfile,
  DatasetRow,
  DetectedIssue,
  IssueCategory,
  RepairProposal,
  RepairStrategyConfig,
  ValidationResult,
} from './types';

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  missing_value: 'Missing Values',
  duplicate_record: 'Duplicate Records',
  invalid_format: 'Invalid Formats',
  inconsistent_entry: 'Inconsistent Entries',
  anomaly: 'Statistical Anomalies',
};

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const SYNONYM_GROUPS: Array<{ canonical: string; variants: Set<string> }> = [
  {
    canonical: 'United States',
    variants: new Set(['us', 'u.s.', 'usa', 'u.s.a.', 'united states', 'united states of america']),
  },
  {
    canonical: 'United Kingdom',
    variants: new Set(['uk', 'u.k.', 'united kingdom', 'great britain', 'gb']),
  },
  {
    canonical: 'United Arab Emirates',
    variants: new Set(['uae', 'u.a.e.', 'united arab emirates']),
  },
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

export function parseDateToIso(raw: string): {
  valid: boolean;
  iso?: string;
  alreadyIso?: boolean;
} {
  const s = raw.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (!isValidCalendarDate(y, m, d)) return { valid: false };
    return { valid: true, iso: s, alreadyIso: true };
  }

  const slashYmd = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s);
  if (slashYmd) {
    const y = Number(slashYmd[1]);
    const m = Number(slashYmd[2]);
    const d = Number(slashYmd[3]);
    if (!isValidCalendarDate(y, m, d)) return { valid: false };
    return { valid: true, iso: `${y}-${pad2(m)}-${pad2(d)}`, alreadyIso: false };
  }

  const slashMdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (slashMdy) {
    const p1 = Number(slashMdy[1]);
    const p2 = Number(slashMdy[2]);
    const y = Number(slashMdy[3]);
    // Support MM/DD/YYYY (fallback to DD/MM/YYYY if p1 > 12)
    let m = p1;
    let d = p2;
    if (p1 > 12 && p2 <= 12) {
      m = p2;
      d = p1;
    }
    if (!isValidCalendarDate(y, m, d)) return { valid: false };
    return { valid: true, iso: `${y}-${pad2(m)}-${pad2(d)}`, alreadyIso: false };
  }

  const textMatch = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
  if (textMatch) {
    const m = MONTH_MAP[textMatch[1].toLowerCase()];
    const d = Number(textMatch[2]);
    const y = Number(textMatch[3]);
    if (!m || !isValidCalendarDate(y, m, d)) return { valid: false };
    return { valid: true, iso: `${y}-${pad2(m)}-${pad2(d)}`, alreadyIso: false };
  }

  return { valid: false };
}

export function isValidEmailFormat(raw: string): boolean {
  const s = raw.trim();
  if (s.includes('..') || /\s/.test(s)) return false;
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s);
}

export function normalizePhone(raw: string): {
  valid: boolean;
  formatted?: string;
  alreadyStandard?: boolean;
} {
  const s = raw.trim();
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) {
    const formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return { valid: true, formatted, alreadyStandard: s === formatted };
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    const local = digits.slice(1);
    const formatted = `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
    return { valid: true, formatted, alreadyStandard: s === formatted };
  }
  if (digits.length >= 11 && digits.length <= 15 && /^\+?[\d\s().-]+$/.test(s)) {
    const formatted = `+${digits}`;
    return { valid: true, formatted, alreadyStandard: s === formatted };
  }
  return { valid: false };
}

function getCanonicalCategoricalMap(rows: DatasetRow[], column: string): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const raw = row[column];
    if (isMissingValue(raw)) continue;
    const trimmed = String(raw).trim();
    const lower = trimmed.toLowerCase();

    let canonicalGroup = lower;
    for (const syn of SYNONYM_GROUPS) {
      if (syn.variants.has(lower)) {
        canonicalGroup = syn.canonical.toLowerCase();
        break;
      }
    }

    if (!counts.has(canonicalGroup)) {
      counts.set(canonicalGroup, new Map());
    }
    const variantCounts = counts.get(canonicalGroup)!;
    variantCounts.set(trimmed, (variantCounts.get(trimmed) ?? 0) + 1);
  }

  const map = new Map<string, string>();
  for (const [groupKey, variantCounts] of counts.entries()) {
    // Prefer full synonym canonical name if any matching synonym exists in dataset
    let bestVariant = '';
    let bestCount = -1;
    const synMatch = SYNONYM_GROUPS.find((s) => s.canonical.toLowerCase() === groupKey);
    if (synMatch && variantCounts.has(synMatch.canonical)) {
      bestVariant = synMatch.canonical;
    } else {
      for (const [variant, cnt] of variantCounts.entries()) {
        // Prefer Title Case on tie
        const isTitle = variant[0] === variant[0]?.toUpperCase() && variant.slice(1) !== variant.slice(1).toUpperCase();
        if (cnt > bestCount || (cnt === bestCount && isTitle)) {
          bestCount = cnt;
          bestVariant = variant;
        }
      }
    }

    for (const variant of variantCounts.keys()) {
      if (variant !== bestVariant) {
        map.set(variant, bestVariant);
      }
    }
  }
  return map;
}

function getColumnMode(rows: DatasetRow[], column: string, canonicalMap: Map<string, string>): string | null {
  const freq = new Map<string, number>();
  for (const row of rows) {
    const raw = row[column];
    if (isMissingValue(raw)) continue;
    const trimmed = String(raw).trim();
    const canonical = canonicalMap.get(trimmed) ?? trimmed;
    freq.set(canonical, (freq.get(canonical) ?? 0) + 1);
  }
  let topVal: string | null = null;
  let topCount = 0;
  for (const [val, cnt] of freq.entries()) {
    if (cnt > topCount) {
      topCount = cnt;
      topVal = val;
    }
  }
  return topVal;
}

function formatNumberClean(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

function isNonNegativeMetricColumn(column: string): boolean {
  const lower = column.toLowerCase();
  return /(spend|revenue|price|amount|cost|salary|age|count|qty|quantity|total|budget|fee)/.test(
    lower
  );
}

export function analyzeDataset(
  rows: DatasetRow[],
  columns: string[],
  strategy: RepairStrategyConfig = { numericMissing: 'median', categoricalMissing: 'mode' }
): AnalysisResult {
  const profiles: ColumnProfile[] = inferColumnProfiles(rows, columns);
  const profileMap = new Map(profiles.map((p) => [p.name, p]));

  const issues: DetectedIssue[] = [];
  const proposals: RepairProposal[] = [];

  let issueSeq = 1;
  let propSeq = 1;

  const missingCountsByCol = new Map<string, number>();
  for (const col of columns) missingCountsByCol.set(col, 0);

  // Track cell-level issue counts for transparent scoring
  let missingCellCount = 0;
  let invalidCellCount = 0;
  let inconsistentCellCount = 0;
  let anomalyCellCount = 0;

  // Precompute categorical normalization maps & modes
  const categoricalMaps = new Map<string, Map<string, string>>();
  const categoricalModes = new Map<string, string | null>();
  for (const col of columns) {
    const prof = profileMap.get(col);
    if (prof?.inferredType === 'categorical') {
      const cmap = getCanonicalCategoricalMap(rows, col);
      categoricalMaps.set(col, cmap);
      categoricalModes.set(col, getColumnMode(rows, col, cmap));
    }
  }

  // 1. Duplicate record detection
  const seenRowSignatures = new Map<string, number>();
  const duplicateRowNumbers: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 1;
    const sig = JSON.stringify(
      columns.map((c) => {
        const v = rows[i][c];
        return isMissingValue(v) ? '__MISSING__' : String(v).trim();
      })
    );
    const firstRow = seenRowSignatures.get(sig);
    if (firstRow !== undefined) {
      duplicateRowNumbers.push(rowNumber);
      const issueId = `ISS-${issueSeq++}`;
      issues.push({
        id: issueId,
        category: 'duplicate_record',
        severity: 'high',
        column: 'All Columns',
        affectedRows: [rowNumber],
        originalValues: [`Row ${rowNumber} duplicates Row ${firstRow}`],
        problemDescription: `Row ${rowNumber} is an exact duplicate of Row ${firstRow}.`,
        likelyCause: 'Repeated export batch, retry submission, or missing primary-key deduplication upstream.',
        recommendedCorrection: `Remove duplicate Row ${rowNumber} while preserving original Row ${firstRow}.`,
        confidence: 99,
        requiresReview: false,
      });
      proposals.push({
        id: `PRP-${propSeq++}`,
        issueId,
        category: 'duplicate_record',
        rowNumber,
        column: 'All Columns',
        originalValue: `Duplicate of Row ${firstRow}`,
        proposedValue: 'Remove duplicate row',
        actionType: 'remove_duplicate_row',
        reason: `Exact duplicate of Row ${firstRow}; first occurrence preserved.`,
        repairMethod: 'Exact-Match Deduplication (Keep First)',
        confidence: 99,
        safeToAutoApply: true,
        status: 'pending',
      });
    } else {
      seenRowSignatures.set(sig, rowNumber);
    }
  }

  // 2–5. Cell-level analysis per column
  for (const col of columns) {
    const prof = profileMap.get(col)!;
    const cmap = categoricalMaps.get(col);
    const modeVal = categoricalModes.get(col) ?? null;

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 1;
      const raw = rows[i][col];
      const rawDisplay = raw === null || raw === undefined ? '' : String(raw);

      // A. Missing Value Check
      if (isMissingValue(raw)) {
        missingCellCount++;
        missingCountsByCol.set(col, (missingCountsByCol.get(col) ?? 0) + 1);

        let proposedValue: string | null = null;
        let repairMethod = 'Preserve Missing (Manual Review)';
        let safeToAutoApply = false;
        let confidence = 60;
        let recommendation = 'Collect missing value from source system; synthetic imputation is unsafe for this field.';

        if (prof.inferredType === 'number' && prof.numericStats && strategy.numericMissing !== 'preserve') {
          const fillVal =
            strategy.numericMissing === 'mean'
              ? prof.numericStats.mean
              : prof.numericStats.median;
          proposedValue = formatNumberClean(fillVal);
          repairMethod =
            strategy.numericMissing === 'mean'
              ? `Mean Imputation (${proposedValue})`
              : `Median Imputation (${proposedValue})`;
          safeToAutoApply = true;
          confidence = 84;
          recommendation = `Impute missing numeric cell using column ${strategy.numericMissing} (${proposedValue}).`;
        } else if (
          prof.inferredType === 'categorical' &&
          modeVal &&
          strategy.categoricalMissing !== 'preserve'
        ) {
          proposedValue = modeVal;
          repairMethod = `Mode Imputation ("${modeVal}")`;
          safeToAutoApply = true;
          confidence = 82;
          recommendation = `Impute missing category with column mode "${modeVal}".`;
        }

        const issueId = `ISS-${issueSeq++}`;
        issues.push({
          id: issueId,
          category: 'missing_value',
          severity: prof.inferredType === 'email' || prof.inferredType === 'phone' ? 'high' : 'medium',
          column: col,
          affectedRows: [rowNumber],
          originalValues: [rawDisplay === '' ? '(empty)' : rawDisplay],
          problemDescription: `Missing value (${rawDisplay === '' ? 'empty cell' : `"${rawDisplay}"`}) in ${prof.inferredType} column "${col}".`,
          likelyCause: 'Optional form field skipped during ingestion or null placeholder ("NA"/"NaN") exported by upstream pipeline.',
          recommendedCorrection: recommendation,
          confidence,
          requiresReview: !safeToAutoApply,
        });

        proposals.push({
          id: `PRP-${propSeq++}`,
          issueId,
          category: 'missing_value',
          rowNumber,
          column: col,
          originalValue: rawDisplay === '' ? '(empty)' : rawDisplay,
          proposedValue,
          actionType: proposedValue !== null ? 'update_cell' : 'flag_for_review',
          reason:
            proposedValue !== null
              ? `Missing ${prof.inferredType} value replaced using ${repairMethod}.`
              : `No safe automatic imputation for ${prof.inferredType} field "${col}".`,
          repairMethod,
          confidence,
          safeToAutoApply,
          status: 'pending',
        });
        continue;
      }

      const trimmed = rawDisplay.trim();

      // Check leading/trailing whitespace on non-missing string
      if (rawDisplay !== trimmed) {
        inconsistentCellCount++;
        const issueId = `ISS-${issueSeq++}`;
        issues.push({
          id: issueId,
          category: 'inconsistent_entry',
          severity: 'low',
          column: col,
          affectedRows: [rowNumber],
          originalValues: [`"${rawDisplay}"`],
          problemDescription: `Leading or trailing whitespace detected around "${trimmed}".`,
          likelyCause: 'Unstripped copy-paste input or fixed-width export padding.',
          recommendedCorrection: `Trim surrounding whitespace to "${trimmed}".`,
          confidence: 99,
          requiresReview: false,
        });
        proposals.push({
          id: `PRP-${propSeq++}`,
          issueId,
          category: 'inconsistent_entry',
          rowNumber,
          column: col,
          originalValue: rawDisplay,
          proposedValue: trimmed,
          actionType: 'update_cell',
          reason: 'Remove leading and trailing whitespace.',
          repairMethod: 'Whitespace Trimming',
          confidence: 99,
          safeToAutoApply: true,
          status: 'pending',
        });
      }

      // B. Type-specific format & consistency checks
      if (prof.inferredType === 'email') {
        if (!isValidEmailFormat(trimmed)) {
          invalidCellCount++;
          const issueId = `ISS-${issueSeq++}`;
          issues.push({
            id: issueId,
            category: 'invalid_format',
            severity: 'high',
            column: col,
            affectedRows: [rowNumber],
            originalValues: [trimmed],
            problemDescription: `Malformed email address "${trimmed}" fails standard domain/syntax validation.`,
            likelyCause: 'Typo during manual entry (missing TLD or consecutive dots) or truncated import.',
            recommendedCorrection: 'Flag for user verification; never fabricate an email address automatically.',
            confidence: 96,
            requiresReview: true,
          });
          proposals.push({
            id: `PRP-${propSeq++}`,
            issueId,
            category: 'invalid_format',
            rowNumber,
            column: col,
            originalValue: trimmed,
            proposedValue: null,
            actionType: 'flag_for_review',
            reason: 'Malformed email cannot be safely guessed without contacting the record owner.',
            repairMethod: 'Flag Unrecoverable Format',
            confidence: 96,
            safeToAutoApply: false,
            status: 'pending',
          });
        } else if (trimmed !== trimmed.toLowerCase()) {
          inconsistentCellCount++;
          const lower = trimmed.toLowerCase();
          const issueId = `ISS-${issueSeq++}`;
          issues.push({
            id: issueId,
            category: 'inconsistent_entry',
            severity: 'low',
            column: col,
            affectedRows: [rowNumber],
            originalValues: [trimmed],
            problemDescription: `Email address "${trimmed}" uses inconsistent uppercase casing.`,
            likelyCause: 'Caps Lock enabled during CRM entry or legacy uppercase export.',
            recommendedCorrection: `Normalize email to lowercase "${lower}".`,
            confidence: 98,
            requiresReview: false,
          });
          proposals.push({
            id: `PRP-${propSeq++}`,
            issueId,
            category: 'inconsistent_entry',
            rowNumber,
            column: col,
            originalValue: trimmed,
            proposedValue: lower,
            actionType: 'update_cell',
            reason: 'Standardize valid email address to canonical lowercase.',
            repairMethod: 'Lowercase Email Normalization',
            confidence: 98,
            safeToAutoApply: true,
            status: 'pending',
          });
        }
      } else if (prof.inferredType === 'phone') {
        const phoneRes = normalizePhone(trimmed);
        if (!phoneRes.valid) {
          invalidCellCount++;
          const issueId = `ISS-${issueSeq++}`;
          issues.push({
            id: issueId,
            category: 'invalid_format',
            severity: 'high',
            column: col,
            affectedRows: [rowNumber],
            originalValues: [trimmed],
            problemDescription: `Phone value "${trimmed}" does not contain a valid 10–15 digit phone number.`,
            likelyCause: 'Incomplete entry or truncated numeric field.',
            recommendedCorrection: 'Preserve original value and flag for manual correction.',
            confidence: 95,
            requiresReview: true,
          });
          proposals.push({
            id: `PRP-${propSeq++}`,
            issueId,
            category: 'invalid_format',
            rowNumber,
            column: col,
            originalValue: trimmed,
            proposedValue: null,
            actionType: 'flag_for_review',
            reason: 'Insufficient digits to reconstruct valid phone number safely.',
            repairMethod: 'Flag Invalid Phone',
            confidence: 95,
            safeToAutoApply: false,
            status: 'pending',
          });
        } else if (!phoneRes.alreadyStandard && phoneRes.formatted) {
          inconsistentCellCount++;
          const issueId = `ISS-${issueSeq++}`;
          issues.push({
            id: issueId,
            category: 'inconsistent_entry',
            severity: 'low',
            column: col,
            affectedRows: [rowNumber],
            originalValues: [trimmed],
            problemDescription: `Phone formatting "${trimmed}" differs from standard pattern (${phoneRes.formatted}).`,
            likelyCause: 'Mixed input masks (parentheses, dots, unformatted digits) across data sources.',
            recommendedCorrection: `Standardize phone format to "${phoneRes.formatted}".`,
            confidence: 94,
            requiresReview: false,
          });
          proposals.push({
            id: `PRP-${propSeq++}`,
            issueId,
            category: 'inconsistent_entry',
            rowNumber,
            column: col,
            originalValue: trimmed,
            proposedValue: phoneRes.formatted,
            actionType: 'update_cell',
            reason: 'Standardize valid phone digits into consistent delimiter format.',
            repairMethod: 'Phone Format Standardization',
            confidence: 94,
            safeToAutoApply: true,
            status: 'pending',
          });
        }
      } else if (prof.inferredType === 'date') {
        const dateRes = parseDateToIso(trimmed);
        if (!dateRes.valid) {
          invalidCellCount++;
          const issueId = `ISS-${issueSeq++}`;
          issues.push({
            id: issueId,
            category: 'invalid_format',
            severity: 'high',
            column: col,
            affectedRows: [rowNumber],
            originalValues: [trimmed],
            problemDescription: `Invalid calendar date "${trimmed}" (out-of-range month/day or unparseable format).`,
            likelyCause: 'Corrupted date string or swapped/impossible day-month value.',
            recommendedCorrection: 'Preserve invalid date and flag for manual audit.',
            confidence: 98,
            requiresReview: true,
          });
          proposals.push({
            id: `PRP-${propSeq++}`,
            issueId,
            category: 'invalid_format',
            rowNumber,
            column: col,
            originalValue: trimmed,
            proposedValue: null,
            actionType: 'flag_for_review',
            reason: 'Impossible calendar date cannot be deterministically repaired.',
            repairMethod: 'Flag Invalid Calendar Date',
            confidence: 98,
            safeToAutoApply: false,
            status: 'pending',
          });
        } else if (!dateRes.alreadyIso && dateRes.iso) {
          inconsistentCellCount++;
          const issueId = `ISS-${issueSeq++}`;
          issues.push({
            id: issueId,
            category: 'inconsistent_entry',
            severity: 'medium',
            column: col,
            affectedRows: [rowNumber],
            originalValues: [trimmed],
            problemDescription: `Non-ISO date format "${trimmed}" breaks chronological sorting and schema consistency.`,
            likelyCause: 'Regional spreadsheet formatting (MM/DD/YYYY or Month DD, YYYY) mixed with ISO dates.',
            recommendedCorrection: `Standardize date to ISO-8601 format "${dateRes.iso}".`,
            confidence: 95,
            requiresReview: false,
          });
          proposals.push({
            id: `PRP-${propSeq++}`,
            issueId,
            category: 'inconsistent_entry',
            rowNumber,
            column: col,
            originalValue: trimmed,
            proposedValue: dateRes.iso,
            actionType: 'update_cell',
            reason: 'Convert valid date into canonical ISO-8601 (YYYY-MM-DD) format.',
            repairMethod: 'ISO-8601 Date Normalization',
            confidence: 95,
            safeToAutoApply: true,
            status: 'pending',
          });
        }
      } else if (prof.inferredType === 'number') {
        const parsedNum = parseNumericCandidate(raw);
        if (parsedNum === null) {
          invalidCellCount++;
          const issueId = `ISS-${issueSeq++}`;
          issues.push({
            id: issueId,
            category: 'invalid_format',
            severity: 'high',
            column: col,
            affectedRows: [rowNumber],
            originalValues: [trimmed],
            problemDescription: `Non-numeric value "${trimmed}" found in numeric column "${col}".`,
            likelyCause: 'Text comment or unparsed symbol stored in a numeric field.',
            recommendedCorrection: 'Flag for manual review before numeric aggregation.',
            confidence: 95,
            requiresReview: true,
          });
          proposals.push({
            id: `PRP-${propSeq++}`,
            issueId,
            category: 'invalid_format',
            rowNumber,
            column: col,
            originalValue: trimmed,
            proposedValue: null,
            actionType: 'flag_for_review',
            reason: 'Unparseable text inside numeric column.',
            repairMethod: 'Flag Non-Numeric Value',
            confidence: 95,
            safeToAutoApply: false,
            status: 'pending',
          });
        } else {
          // Check if currency/comma formatting needs cleaning (e.g. "$7,200.00")
          if (typeof raw === 'string' && !/^-?\d+(\.\d+)?$/.test(trimmed)) {
            invalidCellCount++;
            const cleanStr = formatNumberClean(parsedNum);
            const issueId = `ISS-${issueSeq++}`;
            issues.push({
              id: issueId,
              category: 'invalid_format',
              severity: 'medium',
              column: col,
              affectedRows: [rowNumber],
              originalValues: [trimmed],
              problemDescription: `String-formatted currency/comma number "${trimmed}" in numeric column "${col}".`,
              likelyCause: 'Formatted display string exported instead of raw numeric float/integer.',
              recommendedCorrection: `Parse and normalize to raw numeric value ${cleanStr}.`,
              confidence: 97,
              requiresReview: false,
            });
            proposals.push({
              id: `PRP-${propSeq++}`,
              issueId,
              category: 'invalid_format',
              rowNumber,
              column: col,
              originalValue: trimmed,
              proposedValue: cleanStr,
              actionType: 'update_cell',
              reason: 'Strip currency symbols and thousands separators into clean numeric format.',
              repairMethod: 'Numeric Format Normalization',
              confidence: 97,
              safeToAutoApply: true,
              status: 'pending',
            });
          }

          // C. Anomaly / Outlier check using IQR and domain sign check
          if (prof.numericStats && prof.nonEmptyCount >= 5) {
            const { q1, q3, iqr, median } = prof.numericStats;
            const effectiveIqr = iqr > 0 ? iqr : Math.max(1, Math.abs(median) * 0.25);
            const lowerFence = q1 - 1.5 * effectiveIqr;
            const upperFence = q3 + 1.5 * effectiveIqr;
            const negativeViolation = isNonNegativeMetricColumn(col) && parsedNum < 0;
            const isOutlier = parsedNum > upperFence || parsedNum < lowerFence || negativeViolation;

            if (isOutlier) {
              anomalyCellCount++;
              const issueId = `ISS-${issueSeq++}`;
              const detail = negativeViolation
                ? `Negative value (${parsedNum}) in non-negative metric "${col}" (IQR bounds: ${lowerFence.toFixed(0)} to ${upperFence.toFixed(0)}).`
                : `Statistical outlier (${parsedNum}) exceeds 1.5×IQR fence [${lowerFence.toFixed(0)}, ${upperFence.toFixed(0)}] (median ${median}).`;
              issues.push({
                id: issueId,
                category: 'anomaly',
                severity: negativeViolation ? 'high' : 'medium',
                column: col,
                affectedRows: [rowNumber],
                originalValues: [trimmed],
                problemDescription: detail,
                likelyCause: negativeViolation
                  ? 'Credit/refund entry or accidental minus sign during manual entry.'
                  : 'Legitimate enterprise outlier OR unit/decimal shift (e.g., cents vs dollars, extra zero).',
                recommendedCorrection:
                  'Flagged for human verification. Preserved intact—never auto-deleted without domain confirmation.',
                confidence: 88,
                requiresReview: true,
              });
              proposals.push({
                id: `PRP-${propSeq++}`,
                issueId,
                category: 'anomaly',
                rowNumber,
                column: col,
                originalValue: trimmed,
                proposedValue: null,
                actionType: 'flag_for_review',
                reason: `${detail} Preserved for human audit.`,
                repairMethod: 'IQR Outlier Flagging (Preserve Value)',
                confidence: 88,
                safeToAutoApply: false,
                status: 'pending',
              });
            }
          }
        }
      } else if (prof.inferredType === 'categorical' && cmap) {
        const canonical = cmap.get(trimmed);
        if (canonical && canonical !== trimmed) {
          inconsistentCellCount++;
          const issueId = `ISS-${issueSeq++}`;
          issues.push({
            id: issueId,
            category: 'inconsistent_entry',
            severity: 'medium',
            column: col,
            affectedRows: [rowNumber],
            originalValues: [trimmed],
            problemDescription: `Inconsistent category label "${trimmed}" (canonical value in dataset: "${canonical}").`,
            likelyCause: 'Uncontrolled free-text entry or multi-source abbreviation/casing mismatch.',
            recommendedCorrection: `Standardize "${trimmed}" to canonical category "${canonical}".`,
            confidence: 93,
            requiresReview: false,
          });
          proposals.push({
            id: `PRP-${propSeq++}`,
            issueId,
            category: 'inconsistent_entry',
            rowNumber,
            column: col,
            originalValue: trimmed,
            proposedValue: canonical,
            actionType: 'update_cell',
            reason: `Normalize category variant "${trimmed}" to canonical "${canonical}".`,
            repairMethod: 'Canonical Category Standardization',
            confidence: 93,
            safeToAutoApply: true,
            status: 'pending',
          });
        }
      }
    }
  }

  // Quality scoring formula
  const totalRows = rows.length;
  const totalColumns = columns.length;
  const totalCells = Math.max(1, totalRows * totalColumns);

  const duplicatePenalty = duplicateRowNumbers.length * Math.max(1, totalColumns * 0.75);
  const penaltyPoints = Number(
    (
      missingCellCount * 1.0 +
      invalidCellCount * 1.0 +
      inconsistentCellCount * 0.6 +
      anomalyCellCount * 0.35 +
      duplicatePenalty
    ).toFixed(2)
  );

  const rawScore = 100 - (penaltyPoints / totalCells) * 100;
  const score = Number(Math.max(0, Math.min(100, rawScore)).toFixed(1));

  const completenessRate = Number(
    (Math.max(0, 1 - missingCellCount / totalCells) * 100).toFixed(1)
  );
  const validityRate = Number(
    (Math.max(0, 1 - invalidCellCount / totalCells) * 100).toFixed(1)
  );
  const consistencyRate = Number(
    (Math.max(0, 1 - inconsistentCellCount / totalCells) * 100).toFixed(1)
  );
  const uniquenessRate = Number(
    (Math.max(0, 1 - duplicateRowNumbers.length / Math.max(1, totalRows)) * 100).toFixed(1)
  );

  const categoriesOrder: IssueCategory[] = [
    'missing_value',
    'duplicate_record',
    'invalid_format',
    'inconsistent_entry',
    'anomaly',
  ];

  const issuesByCategory: CategoryCount[] = categoriesOrder.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    count: issues.filter((iss) => iss.category === cat).length,
  }));

  const missingByColumn: ColumnMissingCount[] = columns.map((col) => ({
    column: col,
    missingCount: missingCountsByCol.get(col) ?? 0,
    totalRows,
  }));

  const executiveSummary =
    issues.length === 0
      ? `All ${totalRows} rows across ${totalColumns} columns passed deterministic validation with zero detected defects.`
      : `Detected ${issues.length} quality issues across ${totalRows} rows (${totalCells} cells): ${missingCellCount} missing values, ${duplicateRowNumbers.length} duplicate rows, ${invalidCellCount} invalid formats, ${inconsistentCellCount} inconsistent entries, and ${anomalyCellCount} statistical anomalies flagged for review.`;

  return {
    analyzedAt: new Date().toISOString(),
    quality: {
      score,
      totalRows,
      totalColumns,
      totalCells,
      totalIssues: issues.length,
      penaltyPoints,
      completenessRate,
      validityRate,
      consistencyRate,
      uniquenessRate,
      formulaDescription:
        'Score = 100 − ((Missing×1.0 + Invalid×1.0 + Inconsistent×0.6 + Anomaly×0.35 + DuplicateRows×Cols×0.75) / TotalCells) × 100',
    },
    issues,
    proposals,
    issuesByCategory,
    missingByColumn,
    aiSummary: {
      provider: 'deterministic',
      executiveSummary,
      patternInsights: [
        duplicateRowNumbers.length > 0
          ? `Exact duplicate records detected at rows ${duplicateRowNumbers.join(', ')}.`
          : 'No exact duplicate records detected.',
        anomalyCellCount > 0
          ? `${anomalyCellCount} numeric outlier(s) identified via 1.5×IQR analysis and preserved for human verification.`
          : 'All numeric columns fall within expected IQR bounds.',
        inconsistentCellCount > 0
          ? `${inconsistentCellCount} formatting or casing inconsistencies can be standardized deterministically without data loss.`
          : 'Formatting and category conventions are uniform across columns.',
      ],
    },
  };
}

export function applyApprovedRepairsAndValidate(params: {
  datasetId: string;
  datasetName: string;
  originalRows: DatasetRow[];
  columns: string[];
  initialAnalysis: AnalysisResult;
  decisions: Record<string, 'approved' | 'rejected'>;
  strategy: RepairStrategyConfig;
}): {
  repairedRows: DatasetRow[];
  updatedProposals: RepairProposal[];
  validation: ValidationResult;
  auditEntries: AuditLogEntry[];
} {
  const {
    datasetId,
    datasetName,
    originalRows,
    columns,
    initialAnalysis,
    decisions,
    strategy,
  } = params;

  // Deep clone original rows to preserve original dataset untouched
  const workingRows: DatasetRow[] = originalRows.map((r) => ({ ...r }));
  const timestamp = new Date().toISOString();
  const auditEntries: AuditLogEntry[] = [];
  const rowsToDelete = new Set<number>();

  let repairedCount = 0;
  let rejectedCount = 0;

  const updatedProposals: RepairProposal[] = initialAnalysis.proposals.map((prop) => {
    if (prop.actionType === 'flag_for_review' || prop.proposedValue === null) {
      auditEntries.push({
        id: `AUD-${Date.now()}-${prop.id}`,
        timestamp,
        datasetId,
        datasetName,
        rowNumber: prop.rowNumber,
        column: prop.column,
        originalValue: prop.originalValue,
        repairedValue: prop.originalValue,
        reason: prop.reason,
        repairMethod: prop.repairMethod,
        confidence: prop.confidence,
        approvalStatus: 'flagged_for_review',
      });
      return { ...prop, status: 'pending' };
    }

    const decision = decisions[prop.id] ?? 'rejected';
    if (decision === 'approved') {
      if (prop.actionType === 'remove_duplicate_row') {
        rowsToDelete.add(prop.rowNumber - 1);
      } else if (prop.actionType === 'update_cell') {
        const rowIdx = prop.rowNumber - 1;
        if (workingRows[rowIdx] && prop.column in workingRows[rowIdx]) {
          // If column is numeric and proposedValue parses cleanly as number, keep clean number if original was numeric type
          const numericAttempt = Number(prop.proposedValue);
          const profile = inferColumnProfiles(originalRows, columns).find(
            (p) => p.name === prop.column
          );
          if (
            profile?.inferredType === 'number' &&
            prop.proposedValue !== '' &&
            Number.isFinite(numericAttempt) &&
            /^-?\d+(\.\d+)?$/.test(prop.proposedValue)
          ) {
            workingRows[rowIdx][prop.column] = numericAttempt;
          } else {
            workingRows[rowIdx][prop.column] = prop.proposedValue;
          }
        }
      }

      repairedCount++;
      auditEntries.push({
        id: `AUD-${Date.now()}-${prop.id}`,
        timestamp,
        datasetId,
        datasetName,
        rowNumber: prop.rowNumber,
        column: prop.column,
        originalValue: prop.originalValue,
        repairedValue: prop.proposedValue,
        reason: prop.reason,
        repairMethod: prop.repairMethod,
        confidence: prop.confidence,
        approvalStatus: 'approved',
      });
      return { ...prop, status: 'applied' };
    } else {
      rejectedCount++;
      auditEntries.push({
        id: `AUD-${Date.now()}-${prop.id}`,
        timestamp,
        datasetId,
        datasetName,
        rowNumber: prop.rowNumber,
        column: prop.column,
        originalValue: prop.originalValue,
        repairedValue: prop.originalValue,
        reason: `Rejected by reviewer: ${prop.reason}`,
        repairMethod: prop.repairMethod,
        confidence: prop.confidence,
        approvalStatus: 'rejected',
      });
      return { ...prop, status: 'rejected' };
    }
  });

  // Remove duplicate rows in a clean filter preserving order of kept rows
  const finalRows = workingRows.filter((_, idx) => !rowsToDelete.has(idx));

  // Independent post-repair validation: re-run full analyzer on finalRows
  const postAnalysis = analyzeDataset(finalRows, columns, strategy);

  const originalScore = initialAnalysis.quality.score;
  const newScore = postAnalysis.quality.score;
  const scoreDelta = Number((newScore - originalScore).toFixed(1));
  const issuesBefore = initialAnalysis.issues.length;
  const issuesAfter = postAnalysis.issues.length;

  const hasAutoRepairableLeft = postAnalysis.proposals.some((p) => p.safeToAutoApply);
  const status: ValidationResult['status'] =
    issuesAfter === 0
      ? 'validated'
      : !hasAutoRepairableLeft
        ? 'partially_validated'
        : 'needs_review';

  return {
    repairedRows: finalRows,
    updatedProposals,
    auditEntries,
    validation: {
      validatedAt: new Date().toISOString(),
      originalScore,
      newScore,
      scoreDelta,
      issuesBefore,
      issuesAfter,
      repairedCount,
      unresolvedCount: issuesAfter,
      rejectedCount,
      status,
      beforeAnalysis: initialAnalysis.quality,
      afterAnalysis: postAnalysis.quality,
      afterIssues: postAnalysis.issues,
      afterIssuesByCategory: postAnalysis.issuesByCategory,
      afterMissingByColumn: postAnalysis.missingByColumn,
    },
  };
}
