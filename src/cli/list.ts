// File generated from our OpenAPI spec by Scalar. See README.md for details.

/**
 * Cuts a line to the terminal's width.
 *
 * A row that wrapped would occupy two of them, and the picker's redraw counts rows rather than
 * measuring them, so one wrapped label would put every following frame a line out of place.
 */
export const clip = (text: string, width: number): string =>
  text.length <= width ? text : text.slice(0, Math.max(0, width - 3)) + '...';

export type ListRowOptions = {
  // Terminal width to cut the row to.
  readonly columns: number;
  // Marks the row with `> ` and colours it; the picker moves this with the arrow keys, and a
  // static list uses it for the entry a bare invocation would pick.
  readonly selected?: boolean;
  // Whether the destination is a terminal. Escapes are written only then, so a redirected list
  // is the same text without them.
  readonly color?: boolean;
};

/**
 * Renders one row: a two-column marker, the label, then the detail dimmed behind it.
 *
 * The detail carries what tells otherwise-identical labels apart — a flow name for the picker, a
 * base URL for the environments list — so it is on every row rather than only the marked one, and
 * dimmed so the labels still read as the list. A row too narrow to hold it is emitted as plain
 * clipped text instead: the dimming would otherwise wrap a fragment whose closing bracket the clip
 * has already removed.
 */
export const listRow = (label: string, detail: string, options: ListRowOptions): string => {
  const head = (options.selected ? '> ' : '  ') + label;
  const tail = detail ? '  ' + detail : '';
  const plain = clip(head + tail, options.columns);
  if (!options.color) return plain;
  const row = plain === head + tail ? head + '\u001b[2m' + tail + '\u001b[22m' : plain;
  return options.selected ? '\u001b[36m' + row + '\u001b[39m' : row;
};
