import JSZip from 'jszip';
import type { MilestoneExportReport, MilestoneExportRow, MilestoneExportReference } from './milestone-export';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const HEADER_ROW = 9;
const MAX_ROWS = 1048576;
const MAX_BYTES = 30 * 1024 * 1024;
const HEADERS = ['Project', 'Equipment ID', 'Equipment', 'Record type', 'Status', 'L1 / L2 assignments', 'Closest parents', 'Dependencies', 'Relationship source', 'Review notes'];
const WIDTHS = [22, 25, 40, 16, 18, 48, 36, 38, 48, 60];
const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const xml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const hexEscape = (value: number): string => `_x${value.toString(16).toUpperCase().padStart(4, '0')}_`;

/** SpreadsheetML escapes retain controls/literal _xHHHH_ text without invalid XML or silent loss. */
function spreadsheetText(value: string): string {
  const literal = value.replace(/_x[0-9a-f]{4}_/gi, match => `_x005F_${match.slice(1)}`);
  let safe = '';
  for (let position = 0; position < literal.length; position++) {
    const code = literal.charCodeAt(position);
    if (code === 13 || code < 32 && code !== 9 && code !== 10 || code === 65534 || code === 65535) safe += hexEscape(code);
    else if (code >= 0xD800 && code <= 0xDBFF) {
      const next = literal.charCodeAt(position + 1);
      if (next >= 0xDC00 && next <= 0xDFFF) { safe += literal[position] + literal[++position]; }
      else safe += hexEscape(code);
    } else if (code >= 0xDC00 && code <= 0xDFFF) safe += hexEscape(code);
    else safe += literal[position];
  }
  return xml(safe);
}

function textCell(reference: string, value: string, style = 0): string {
  if (value.length > 32767) throw new Error(`Cell ${reference} exceeds Excel's 32,767-character limit. Reduce the source references before exporting.`);
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${spreadsheetText(value)}</t></is></c>`;
}
function countCell(reference: string, value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('The milestone report contains an invalid record count.');
  return `<c r="${reference}" s="6" t="n"><v>${value}</v></c>`;
}
const referenceLabel = (reference: MilestoneExportReference): string => `${reference.project} · ${reference.tag}${reference.label && reference.label !== reference.tag ? ` (${reference.label})` : ''}`;
const reasons: Record<string, string> = { 'milestone-equipment': 'Milestone membership', 'structural-child': 'Structural child', dependency: 'Dependency', 'upstream-parent': 'Closest parent chain' };
const statusStyles: Record<MilestoneExportRow['status'], number> = { 'not-started': 8, 'in-progress': 9, completed: 10, unknown: 11, conflict: 12 };
interface ReferenceContext { normalized: boolean }
function rowValues(row: MilestoneExportRow, context: ReferenceContext): string[] {
  const sources = row.relationSources.length ? row.relationSources.map(source => `${reasons[source.reason] ?? source.reason}: ${referenceLabel(source.from)}`) : row.reasons.map(reason => reasons[reason] ?? reason);
  const sourceStatus = (row.status === 'unknown' || row.status === 'conflict') && row.sourceStatus.length ? [`Source status: ${row.sourceStatus.join(' · ')}`] : [];
  const values = [row.project, row.tag, row.label, row.recordType === 'equipment' ? 'Equipment' : row.recordType === 'header' ? 'Header' : 'Unavailable', row.statusLabel,
    row.assignments.map(assignment => `${assignment.l1.project} · ${assignment.l1.tag} → ${assignment.l2.tag}`).join('\n'),
    row.immediateParents.map(referenceLabel).join('\n'), row.dependencies.map(referenceLabel).join('\n'),
    sources.join('\n'), [...new Set([...sourceStatus, ...row.reviewFlags, ...row.notes])].join('\n')];
  const counts = [row.assignments.length, row.immediateParents.length, row.dependencies.length, row.relationSources.length || row.reasons.length];
  const descriptions = ['declared L1 / L2 assignment pairs', 'closest-parent references', 'dependency references', 'relationship sources'];
  for (let column = 5; column <= 8; column++) if (values[column].length > 32767 || wrappedLines(values[column], WIDTHS[column]) > 26) {
    context.normalized = true;
    const explanation = column === 8 ? [...new Set(row.reasons.map(reason => reasons[reason] ?? reason))].join('; ') + '\n' : '';
    values[column] = `${counts[column - 5]} ${descriptions[column - 5]}.\n${explanation}See Relationships sheet.`;
  }
  return values;
}

function wrappedLines(value: string, width: number): number {
  const limit = Math.max(4, Math.floor(width - 3));
  const length = (word: string): number => {
    let count = 0;
    for (const character of word) { const code = character.codePointAt(0)!; count += code >= 0x1F000 || /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/.test(character) ? 2 : character === '\t' ? 4 : 1; }
    return count;
  };
  return value.split(/\r\n|\r|\n/).reduce((total, paragraph) => {
    let lines = 1, used = 0;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const size = length(word), space = used ? 1 : 0;
      if (used && used + space + size > limit) { lines++; used = 0; }
      if (size > limit) { lines += Math.floor((size - 1) / limit); used = (size - 1) % limit + 1; }
      else used += (used ? 1 : 0) + size;
    }
    return total + lines;
  }, 0);
}

interface Sheet { name: string; rows: MilestoneExportRow[]; table: string; title: string }
function sheetXml(report: MilestoneExportReport, sheet: Sheet, timestamp: string, tableId: number, references: ReferenceContext): string {
  if (sheet.rows.length > MAX_ROWS - HEADER_ROW) throw new Error(`The ${sheet.name} sheet exceeds Excel's row limit.`);
  const lastRow = Math.max(HEADER_ROW + 1, HEADER_ROW + sheet.rows.length), data: string[] = [];
  const title = `L2 milestone · ${report.milestone.label || report.milestone.tag}`;
  const context = `Project: ${report.milestone.project} · L1: ${report.milestone.parentMilestones.map(parent => parent.label || parent.tag).join(', ') || 'Not supplied'} · L2: ${report.milestone.tag}`;
  const note = `Source coverage: ${report.provenance.sourceRows.toLocaleString('en-US')} registry rows received. Report/model filters can omit records. This snapshot does not certify project completion.`;
  const sourceNote = `Original assignments retained. Unknown/conflicting statuses require review. Completed outside records excluded: ${report.counts.excludedCompleted.toLocaleString('en-US')}.`;
  data.push(`<row r="1" ht="32" customHeight="1">${textCell('A1', title, 1)}</row>`);
  data.push(`<row r="2" ht="30" customHeight="1">${textCell('A2', context, 2)}</row>`);
  data.push(`<row r="3" ht="20" customHeight="1">${textCell('A3', `Exported ${timestamp} · Static source snapshot`, 3)}</row>`);
  data.push(`<row r="4" ht="25" customHeight="1">${textCell('A4', `${sheet.title.toUpperCase()} · ${sheet.rows.length.toLocaleString('en-US')} records`, 4)}</row>`);
  const states = ['not-started', 'in-progress', 'completed', 'unknown', 'conflict'] as const;
  const summaryLabels = ['Not Started', 'In Progress', 'Completed', 'Unknown', 'Conflict'];
  const counts = new Map<string, number>(); for (const row of sheet.rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  data.push(`<row r="5" ht="27" customHeight="1">${states.map((state, index) => textCell(`${String.fromCharCode(65 + index * 2)}5`, summaryLabels[index], 5) + countCell(`${String.fromCharCode(66 + index * 2)}5`, counts.get(state) ?? 0)).join('')}</row>`);
  data.push(`<row r="6" ht="28" customHeight="1">${textCell('A6', note, 3)}</row>`);
  data.push(`<row r="7" ht="28" customHeight="1">${textCell('A7', sourceNote, 3)}</row>`);
  data.push(`<row r="8" ht="9" customHeight="1"/>`);
  data.push(`<row r="${HEADER_ROW}" ht="28" customHeight="1">${HEADERS.map((header, column) => textCell(`${String.fromCharCode(65 + column)}${HEADER_ROW}`, header, 7)).join('')}</row>`);
  sheet.rows.forEach((row, index) => {
    const line = HEADER_ROW + index + 1, values = rowValues(row, references);
    const cells = values.map((value, column) => {
      const style = column === 4 ? statusStyles[row.status] : column === 9 && row.reviewRequired ? 12 : row.recordType === 'equipment' ? 0 : 13;
      return textCell(`${String.fromCharCode(65 + column)}${line}`, value, style);
    }).join('');
    const lines = Math.max(1, ...values.map((value, column) => wrappedLines(value, WIDTHS[column]))), height = Math.max(32, lines * 15 + 8);
    if (height > 409) throw new Error(`Row ${line} in ${sheet.name} exceeds Excel's readable row-height limit. Reduce its source references or notes before exporting.`);
    data.push(`<row r="${line}" ht="${height}" customHeight="1">${cells}</row>`);
  });
  if (!sheet.rows.length) data.push(`<row r="${HEADER_ROW + 1}" ht="30" customHeight="1">${textCell(`A${HEADER_ROW + 1}`, 'No records in this worklist from the supplied data.', 3)}</row>`);
  const merges = [1, 2, 3, 4, 6, 7, ...(!sheet.rows.length ? [HEADER_ROW + 1] : [])].map(row => `<mergeCell ref="A${row}:J${row}"/>`).join('');
  return `${DECLARATION}<worksheet xmlns="${NS}" xmlns:r="${REL}"><sheetPr><pageSetUpPr fitToPage="0" autoPageBreaks="1"/></sheetPr><dimension ref="A1:J${lastRow}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="2" ySplit="${HEADER_ROW}" topLeftCell="C${HEADER_ROW + 1}" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="C${HEADER_ROW + 1}" sqref="C${HEADER_ROW + 1}"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${WIDTHS.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${data.join('')}</sheetData>${sheet.rows.length ? '' : `<autoFilter ref="A${HEADER_ROW}:J${HEADER_ROW}"/>`}<mergeCells count="${6 + Number(!sheet.rows.length)}">${merges}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" scale="100"/><headerFooter><oddFooter>&amp;LSSM milestone worklist&amp;RPage &amp;P of &amp;N</oddFooter></headerFooter>${sheet.rows.length ? `<tableParts count="1"><tablePart r:id="rId${tableId}"/></tableParts>` : ''}</worksheet>`;
}

function tableXml(sheet: Sheet, tableId: number): string {
  const range = `A${HEADER_ROW}:J${HEADER_ROW + sheet.rows.length}`;
  return `${DECLARATION}<table xmlns="${NS}" id="${tableId}" name="${sheet.table}" displayName="${sheet.table}" ref="${range}" totalsRowShown="0"><autoFilter ref="${range}"/><tableColumns count="${HEADERS.length}">${HEADERS.map((header, index) => `<tableColumn id="${index + 1}" name="${xml(header)}"/>`).join('')}</tableColumns><tableStyleInfo name="TableStyleLight1" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`;
}

interface NormalizedReference {
  kind: 'Closest parent' | 'Dependency' | 'Milestone assignment' | 'Milestone membership';
  from: MilestoneExportReference;
  to: MilestoneExportReference;
  parent?: MilestoneExportReference;
}
/** High-fanout references are kept once per actual endpoint/pair, outside the one-record worklists. */
function normalizedReferences(report: MilestoneExportReport): NormalizedReference[] {
  const records = new Map<string, NormalizedReference>();
  const add = (kind: NormalizedReference['kind'], from: MilestoneExportReference, to: MilestoneExportReference, parent?: MilestoneExportReference): void => {
    const key = JSON.stringify([kind, from.nodeKey, to.nodeKey, parent?.nodeKey ?? null]);
    if (!records.has(key)) records.set(key, { kind, from, to, parent });
  };
  for (const relation of report.provenance.relations) add(relation.kind === 'parent' ? 'Closest parent' : 'Dependency', relation.from, relation.to);
  for (const row of report.rows) {
    row.assignments.forEach(assignment => add('Milestone assignment', row, assignment.l2, assignment.l1));
    row.immediateParents.forEach(parent => add('Closest parent', row, parent));
    row.dependencies.forEach(dependency => add('Dependency', row, dependency));
    for (const source of row.relationSources) {
      if (source.reason === 'dependency') add('Dependency', source.from, row);
      else if (source.reason === 'structural-child') add('Closest parent', row, source.from);
      else if (source.reason === 'upstream-parent') add('Closest parent', source.from, row);
      else if (!row.assignments.some(assignment => assignment.l2.nodeKey === source.from.nodeKey)) add('Milestone membership', row, source.from);
    }
  }
  if (records.size > MAX_ROWS - HEADER_ROW) throw new Error('The normalized Relationships sheet exceeds Excel\'s row limit.');
  return [...records.values()];
}

function relationshipsXml(report: MilestoneExportReport, records: NormalizedReference[], timestamp: string): { sheet: string; table: string } {
  const headings = ['Relationship', 'From project', 'From ID', 'From equipment / milestone', 'To project', 'To ID', 'To equipment / milestone', 'Assigned L1'];
  const widths = [25, 22, 25, 40, 22, 25, 40, 44], data: string[] = [];
  const top = [
    `L2 milestone · ${report.milestone.label || report.milestone.tag}`,
    `Project: ${report.milestone.project} · L2: ${report.milestone.tag}`,
    `Exported ${timestamp} · Static source snapshot`,
    `RELATIONSHIPS · ${records.length.toLocaleString('en-US')} references`,
    'Direction: child → closest parent; consumer → prerequisite. Assignment rows preserve the declared L1 / L2 pair.',
    'Complete reference detail for summarized worklist cells. Report/model filters can omit records.',
    'Original projects and identifiers retained. Completed outside records remain excluded.',
  ];
  top.forEach((value, index) => data.push(`<row r="${index + 1}" ht="${index === 0 ? 32 : index === 3 ? 25 : 28}" customHeight="1">${textCell(`A${index + 1}`, value, index === 0 ? 1 : index === 3 ? 4 : index === 1 ? 2 : 3)}</row>`));
  data.push('<row r="8" ht="9" customHeight="1"/>');
  data.push(`<row r="${HEADER_ROW}" ht="28" customHeight="1">${headings.map((value, index) => textCell(`${String.fromCharCode(65 + index)}${HEADER_ROW}`, value, 7)).join('')}</row>`);
  records.forEach((record, index) => {
    const row = HEADER_ROW + index + 1;
    const values = [record.kind, record.from.project, record.from.tag, record.from.label, record.to.project, record.to.tag, record.to.label, record.parent ? referenceLabel(record.parent) : ''];
    const cells = values.map((value, column) => textCell(`${String.fromCharCode(65 + column)}${row}`, value)).join('');
    const height = Math.max(32, Math.max(...values.map((value, column) => wrappedLines(value, widths[column]))) * 15 + 8);
    if (height > 409) throw new Error(`Row ${row} in Relationships exceeds Excel's readable row-height limit. Reduce its descriptions before exporting.`);
    data.push(`<row r="${row}" ht="${height}" customHeight="1">${cells}</row>`);
  });
  const range = `A${HEADER_ROW}:H${HEADER_ROW + records.length}`;
  const sheet = `${DECLARATION}<worksheet xmlns="${NS}" xmlns:r="${REL}"><sheetPr><pageSetUpPr fitToPage="0" autoPageBreaks="1"/></sheetPr><dimension ref="A1:H${HEADER_ROW + records.length}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="3" ySplit="${HEADER_ROW}" topLeftCell="D${HEADER_ROW + 1}" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="D${HEADER_ROW + 1}" sqref="D${HEADER_ROW + 1}"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${data.join('')}</sheetData><mergeCells count="7">${top.map((_value, index) => `<mergeCell ref="A${index + 1}:H${index + 1}"/>`).join('')}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" scale="100"/><tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>`;
  const table = `${DECLARATION}<table xmlns="${NS}" id="3" name="MilestoneRelationships" displayName="MilestoneRelationships" ref="${range}" totalsRowShown="0"><autoFilter ref="${range}"/><tableColumns count="${headings.length}">${headings.map((heading, index) => `<tableColumn id="${index + 1}" name="${xml(heading)}"/>`).join('')}</tableColumns><tableStyleInfo name="TableStyleLight1" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`;
  return { sheet, table };
}

function stylesXml(): string {
  const fonts = [
    '<font><sz val="11"/><color rgb="FF24313C"/><name val="Calibri"/><family val="2"/></font>',
    '<font><b/><sz val="18"/><color rgb="FF243D49"/><name val="Calibri"/><family val="2"/></font>',
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>',
    '<font><b/><sz val="11"/><color rgb="FF243D49"/><name val="Calibri"/><family val="2"/></font>',
    '<font><sz val="9"/><color rgb="FF5F6B75"/><name val="Calibri"/><family val="2"/></font>',
    '<font><b/><sz val="14"/><color rgb="FF087F80"/><name val="Calibri"/><family val="2"/></font>',
  ];
  const colors = ['243D49', '087F80', 'F5F7F8', 'E5E7EB', 'FEF3C7', 'D1FAE5', 'F9FAFB', 'FEE2E2'];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>', ...colors.map(color => `<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`)];
  const xf = (font: number, fill: number, wrap = true, border = 0): string => `<xf numFmtId="0" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyBorder="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top"${wrap ? ' wrapText="1"' : ''}/></xf>`;
  const formats = [xf(0, 0), xf(1, 0, true, 1), xf(3, 0), xf(4, 0), xf(2, 3), xf(3, 4), xf(5, 0, false), xf(2, 2), xf(0, 5), xf(0, 6), xf(0, 7), xf(0, 8), xf(0, 9), xf(4, 4)];
  return `${DECLARATION}<styleSheet xmlns="${NS}"><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF087F80"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${formats.length}">${formats.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleLight1" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`;
}

/** Browser-only OOXML packaging. The caller applies the Power BI download privilege/consent gate. */
export async function createMilestoneWorkbook(report: MilestoneExportReport): Promise<string> {
  if (!report.provenance.allDataReceived) throw new Error('Finish loading all available source rows before exporting the workbook.');
  if (report.rows.length > MAX_ROWS - HEADER_ROW) throw new Error('The milestone worklist exceeds Excel\'s row limit.');
  const sheets: Sheet[] = [
    { name: 'Milestone equipment', table: 'MilestoneEquipment', title: 'Milestone equipment', rows: [], },
    { name: 'Related equipment', table: 'RelatedEquipment', title: 'Related equipment · outside selected milestone', rows: [], },
  ];
  for (const row of report.rows) sheets[row.inMilestone ? 0 : 1].rows.push(row);
  const timestamp = new Date().toISOString(), zip = new JSZip(), context: ReferenceContext = { normalized: false };
  const overrides: string[] = [];
  sheets.forEach((sheet, index) => {
    const id = index + 1;
    zip.file(`xl/worksheets/sheet${id}.xml`, sheetXml(report, sheet, timestamp, id, context));
    overrides.push(`<Override PartName="/xl/worksheets/sheet${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    if (sheet.rows.length) {
      zip.file(`xl/tables/table${id}.xml`, tableXml(sheet, id));
      zip.file(`xl/worksheets/_rels/sheet${id}.xml.rels`, `${DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId${id}" Type="${REL}/table" Target="../tables/table${id}.xml"/></Relationships>`);
      overrides.push(`<Override PartName="/xl/tables/table${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`);
    }
  });
  const names = sheets.map(sheet => sheet.name);
  if (context.normalized) {
    const normalized = relationshipsXml(report, normalizedReferences(report), timestamp);
    names.push('Relationships');
    zip.file('xl/worksheets/sheet3.xml', normalized.sheet); zip.file('xl/tables/table3.xml', normalized.table);
    zip.file('xl/worksheets/_rels/sheet3.xml.rels', `${DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/table" Target="../tables/table3.xml"/></Relationships>`);
    overrides.push('<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>', '<Override PartName="/xl/tables/table3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>');
  }
  zip.file('xl/styles.xml', stylesXml());
  zip.file('xl/workbook.xml', `${DECLARATION}<workbook xmlns="${NS}" xmlns:r="${REL}"><bookViews><workbookView/></bookViews><sheets>${names.map((name, index) => `<sheet name="${name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets><definedNames>${names.map((name, index) => `<definedName name="_xlnm.Print_Titles" localSheetId="${index}">'${name}'!$1:$${HEADER_ROW},'${name}'!$A:$${name === 'Relationships' ? 'C' : 'B'}</definedName>`).join('')}</definedNames><calcPr calcId="191029" fullCalcOnLoad="0"/></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `${DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_name, index) => `<Relationship Id="rId${index + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${names.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`);
  zip.file('_rels/.rels', `${DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  zip.file('docProps/core.xml', `${DECLARATION}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>SSM milestone completion worklist</dc:title><dc:creator>LotusWorks</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified></cp:coreProperties>`);
  zip.file('docProps/app.xml', `${DECLARATION}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>SSM Explorer</Application></Properties>`);
  zip.file('[Content_Types].xml', `${DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${overrides.join('')}</Types>`);
  const output = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 3 } });
  const bytes = Math.floor(output.length * 3 / 4) - (output.endsWith('==') ? 2 : output.endsWith('=') ? 1 : 0);
  if (bytes > MAX_BYTES) throw new Error('The workbook exceeds Power BI\'s 30 MB download limit. Reduce the source worklist before exporting.');
  return output;
}
