// File generated from our OpenAPI spec by Scalar. See README.md for details.

const INDENT = '  ';

// Marker for an object with no fields, mirroring the `[0]` an empty array gets. Safe as a bare
// token because `needsQuotes` quotes any string containing a brace, so a literal "{}" value
// cannot be confused with it.
const EMPTY_OBJECT = '{}';

/** Leaf values TOON renders on a single line. */
type ToonPrimitive = string | number | boolean | null;

// Bare (unquoted) keys are restricted to a conservative identifier shape so a
// TOON reader can never confuse a key with structural syntax; other keys are
// emitted JSON-quoted.
const BARE_KEY = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

// Strings matching a number literal must be quoted, otherwise a reader would
// decode them as numbers and the round-trip would be lossy.
const NUMBER_LIKE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

/**
 * Encodes a JSON-compatible value as TOON text. Undefined object properties
 * are dropped (matching JSON.stringify); non-finite numbers become null.
 */
export const encodeToon = (value: unknown): string => encodeValueLines(value, 0).join('\n');

const encodeValueLines = (value: unknown, depth: number): string[] => {
  if (Array.isArray(value)) return encodeArray(undefined, value, depth);
  // An object with no fields encodes to no lines, which would make a successful empty response
  // (a DELETE returning `{}`) indistinguishable from no output at all. `{}` is the object's
  // counterpart to the `[0]` marker an empty array already gets.
  if (isPlainRecord(value))
    return isEmptyRecord(value) ? [INDENT.repeat(depth) + EMPTY_OBJECT] : encodeObject(value, depth);
  return [INDENT.repeat(depth) + formatPrimitive(value)];
};

const encodeObject = (obj: Record<string, unknown>, depth: number): string[] => {
  const pad = INDENT.repeat(depth);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    // Dropped like JSON.stringify drops them: absent and undefined fields serialize identically.
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      lines.push(...encodeArray(key, value, depth));
    } else if (isPlainRecord(value)) {
      // Same reasoning as the top level: a bare `key:` with nothing under it reads as a missing
      // value rather than an empty one.
      if (isEmptyRecord(value)) lines.push(pad + formatKey(key) + ': ' + EMPTY_OBJECT);
      else {
        lines.push(pad + formatKey(key) + ':');
        lines.push(...encodeObject(value, depth + 1));
      }
    } else {
      lines.push(pad + formatKey(key) + ': ' + formatPrimitive(value));
    }
  }
  return lines;
};

// Arrays pick the densest legal layout: inline for all-primitive elements,
// tabular (one header, one row per element) for flat objects, and an explicit
// dash list otherwise. The [N] length marker always appears so agents get a
// definitive count even for empty results.
const encodeArray = (key: string | undefined, values: readonly unknown[], depth: number): string[] => {
  const pad = INDENT.repeat(depth);
  const prefix = key === undefined ? '' : formatKey(key);
  if (values.length === 0) return [pad + prefix + '[0]:'];
  if (values.every(isToonPrimitive)) {
    return [pad + prefix + '[' + values.length + ']: ' + values.map(formatPrimitive).join(',')];
  }
  const fields = tabularFields(values);
  if (fields) {
    const rowPad = INDENT.repeat(depth + 1);
    return [
      pad + prefix + '[' + values.length + ']{' + fields.map(formatKey).join(',') + '}:',
      ...values.map((row) => rowPad + fields.map((field) => formatPrimitive(cell(row, field))).join(',')),
    ];
  }
  return [
    pad + prefix + '[' + values.length + ']:',
    ...values.flatMap((item) => encodeListItem(item, depth + 1)),
  ];
};

// One dash-list element: objects put their first field on the dash line and
// align the rest underneath it, per the TOON list layout.
const encodeListItem = (item: unknown, depth: number): string[] => {
  const pad = INDENT.repeat(depth);
  if (isToonPrimitive(item)) return [pad + '- ' + formatPrimitive(item)];
  if (Array.isArray(item)) {
    const [header, ...rest] = encodeArray(undefined, item, depth + 1);
    return [pad + '- ' + (header ?? '').trimStart(), ...rest];
  }
  const lines = encodeObject(item as Record<string, unknown>, depth + 1);
  if (lines.length === 0) return [pad + '- ' + EMPTY_OBJECT];
  const [first, ...rest] = lines;
  return [pad + '- ' + (first ?? '').trimStart(), ...rest];
};

// Field list (union of keys, first-seen order) when every element is a flat
// object with only primitive values. Elements missing a field render an
// explicit null cell, so mostly-uniform API rows (e.g. an optional field on
// some items) still collapse into the dense tabular form.
const tabularFields = (values: readonly unknown[]): string[] | undefined => {
  const fields: string[] = [];
  for (const item of values) {
    if (!isPlainRecord(item)) return undefined;
    for (const [key, value] of Object.entries(item)) {
      if (value !== undefined && !isToonPrimitive(value)) return undefined;
      if (!fields.includes(key)) fields.push(key);
    }
  }
  return fields.length > 0 ? fields : undefined;
};

// One tabular cell. Own properties only: a bare `row[field]` resolves through Object.prototype,
// so a row that simply lacks a field named `toString`, `constructor`, or `valueOf` would render
// the function source of that builtin into the cell instead of the intended `null`. The field
// list comes from own enumerable keys, so an inherited hit is always a missing value.
const cell = (row: unknown, field: string): unknown =>
  isPlainRecord(row) && Object.hasOwn(row, field) ? row[field] : undefined;

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isEmptyRecord = (value: Record<string, unknown>): boolean =>
  Object.values(value).every((entry) => entry === undefined);

const isToonPrimitive = (value: unknown): value is ToonPrimitive =>
  value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

// Control characters, DEL, and the Unicode line/paragraph separators. API strings are
// untrusted, and these reach the terminal verbatim in bare form: a lone ESC or backspace can
// repaint or erase output that has already been printed, so the value would no longer say what
// the API returned. Quoting routes them through the escaping in `quote` below.
const UNSAFE_RAW = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;

// JSON string syntax, then the characters JSON.stringify still leaves raw: it escapes only
// below U+0020, so DEL, the C1 block, and the line/paragraph separators need escaping here.
const quote = (text: string): string =>
  JSON.stringify(text).replace(
    /[\u007f-\u009f\u2028\u2029]/gu,
    (character) => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'),
  );

const formatKey = (key: string): string => (BARE_KEY.test(key) ? key : quote(key));

const formatPrimitive = (value: unknown): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  // Non-finite numbers have no TOON literal, so mirror JSON.stringify and emit null.
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  const text = String(value);
  return needsQuotes(text) ? quote(text) : text;
};

// Quotes on the safe side: anything a TOON reader could mistake for structure
// (delimiters, brackets, a leading dash item marker), a literal (number, bool,
// null), whitespace that bare form would silently trim, or a control character
// the terminal would act on instead of print.
const needsQuotes = (text: string): boolean => {
  if (text === '') return true;
  if (/^\s|\s$/.test(text)) return true;
  if (/[",:\\\n\r\t[\]{}]/.test(text)) return true;
  if (UNSAFE_RAW.test(text)) return true;
  if (text.startsWith('- ') || text === '-') return true;
  if (text === 'true' || text === 'false' || text === 'null') return true;
  return NUMBER_LIKE.test(text);
};
