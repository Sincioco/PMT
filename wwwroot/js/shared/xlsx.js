const encoder = new TextEncoder();
const decoder = new TextDecoder();
const crcTable = buildCrcTable();

export function createXlsxBlob({ sheetName = "Export", columns = [], rows = [] } = {}) {
  const safeSheetName = sanitizeSheetName(sheetName);
  const tableRows = [
    columns.map(column => column.header),
    ...rows.map(row => columns.map(column => column.value(row)))
  ];

  const entries = [
    { name: "[Content_Types].xml", text: contentTypesXml() },
    { name: "_rels/.rels", text: packageRelationshipsXml() },
    { name: "docProps/app.xml", text: appPropertiesXml(safeSheetName) },
    { name: "docProps/core.xml", text: corePropertiesXml() },
    { name: "xl/workbook.xml", text: workbookXml(safeSheetName) },
    { name: "xl/_rels/workbook.xml.rels", text: workbookRelationshipsXml() },
    { name: "xl/styles.xml", text: stylesXml() },
    { name: "xl/worksheets/sheet1.xml", text: worksheetXml(tableRows) }
  ];

  return new Blob([buildZip(entries)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

export function createZipBlob(entries, type = "application/zip") {
  return new Blob([buildZip(entries)], { type });
}

export async function readXlsxObjects(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = await unzipEntries(bytes);
  const worksheetEntry = entries.get("xl/worksheets/sheet1.xml")
    || [...entries.entries()].find(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))?.[1];
  if (!worksheetEntry) throw new Error("The Excel file does not contain a worksheet.");

  const sharedStrings = entries.has("xl/sharedStrings.xml")
    ? parseSharedStrings(xmlDocument(decodeBytes(entries.get("xl/sharedStrings.xml"))))
    : [];
  const rows = parseWorksheetRows(xmlDocument(decodeBytes(worksheetEntry)), sharedStrings);
  if (!rows.length) return [];

  const headers = rows[0].map(header => String(header || "").trim());
  return rows.slice(1)
    .filter(row => row.some(value => String(value ?? "").trim()))
    .map(row => {
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row[index] ?? "";
      });
      return record;
    });
}

function worksheetXml(rows) {
  const rowXml = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cells = row.map((value, columnIndex) => cellXml(value, columnIndex + 1, rowNumber)).join("");
    return `<row r="${rowNumber}">${cells}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function cellXml(value, columnNumber, rowNumber) {
  const ref = `${columnName(columnNumber)}${rowNumber}`;
  const text = String(value ?? "");
  if (!text) return `<c r="${ref}"/>`;
  return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(text)}</t></is></c>`;
}

function workbookXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function workbookRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function packageRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function appPropertiesXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>PMT</Application>
  <TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${xmlEscape(sheetName)}</vt:lpstr></vt:vector></TitlesOfParts>
</Properties>`;
}

function corePropertiesXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>PMT</dc:creator>
  <cp:lastModifiedBy>PMT</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach(entry => {
    const nameBytes = encodeText(entry.name);
    const dataBytes = entryBytes(entry);
    const crc = crc32(dataBytes);
    const localHeader = zipLocalHeader(nameBytes, dataBytes, crc);
    const centralHeader = zipCentralHeader(nameBytes, dataBytes, crc, offset);

    localParts.push(localHeader, dataBytes);
    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  });

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const endRecord = zipEndRecord(entries.length, centralSize, offset);
  return concatBytes([...localParts, ...centralParts, endRecord]);
}

function entryBytes(entry) {
  if (Object.prototype.hasOwnProperty.call(entry, "bytes")) {
    if (entry.bytes instanceof Uint8Array) return entry.bytes;
    if (entry.bytes instanceof ArrayBuffer) return new Uint8Array(entry.bytes);
    if (ArrayBuffer.isView(entry.bytes)) {
      return new Uint8Array(entry.bytes.buffer, entry.bytes.byteOffset, entry.bytes.byteLength);
    }
  }

  return encodeText(entry.text || "");
}

function zipLocalHeader(nameBytes, dataBytes, crc) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  setDosDateTime(view, 10);
  view.setUint32(14, crc, true);
  view.setUint32(18, dataBytes.length, true);
  view.setUint32(22, dataBytes.length, true);
  view.setUint16(26, nameBytes.length, true);
  header.set(nameBytes, 30);
  return header;
}

function zipCentralHeader(nameBytes, dataBytes, crc, offset) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  setDosDateTime(view, 12);
  view.setUint32(16, crc, true);
  view.setUint32(20, dataBytes.length, true);
  view.setUint32(24, dataBytes.length, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint32(42, offset, true);
  header.set(nameBytes, 46);
  return header;
}

function zipEndRecord(entryCount, centralSize, centralOffset) {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return header;
}

async function unzipEntries(bytes) {
  const endOffset = findEndOfCentralDirectory(bytes);
  const endView = new DataView(bytes.buffer, bytes.byteOffset + endOffset, 22);
  const entryCount = endView.getUint16(10, true);
  let offset = endView.getUint32(16, true);
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 46);
    if (view.getUint32(0, true) !== 0x02014b50) throw new Error("The Excel file has an invalid ZIP directory.");

    const method = view.getUint16(10, true);
    const compressedSize = view.getUint32(20, true);
    const nameLength = view.getUint16(28, true);
    const extraLength = view.getUint16(30, true);
    const commentLength = view.getUint16(32, true);
    const localOffset = view.getUint32(42, true);
    const name = decodeBytes(bytes.slice(offset + 46, offset + 46 + nameLength));
    entries.set(name, await readZipEntry(bytes, localOffset, method, compressedSize));
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

async function readZipEntry(bytes, localOffset, method, compressedSize) {
  const view = new DataView(bytes.buffer, bytes.byteOffset + localOffset, 30);
  if (view.getUint32(0, true) !== 0x04034b50) throw new Error("The Excel file has an invalid ZIP entry.");

  const nameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const data = bytes.slice(dataStart, dataStart + compressedSize);

  if (method === 0) return data;
  if (method === 8) return inflateRaw(data);
  throw new Error("This Excel file uses an unsupported compression method.");
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot read compressed Excel files.");
  }

  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
}

function parseWorksheetRows(document, sharedStrings) {
  return [...document.querySelectorAll("sheetData row")].map(row => {
    const values = [];
    row.querySelectorAll("c").forEach(cell => {
      const ref = cell.getAttribute("r") || "";
      const columnIndex = columnIndexFromRef(ref);
      values[columnIndex] = cellValue(cell, sharedStrings);
    });
    return values;
  });
}

function parseSharedStrings(document) {
  return [...document.querySelectorAll("si")].map(item =>
    [...item.querySelectorAll("t")].map(node => node.textContent || "").join("")
  );
}

function cellValue(cell, sharedStrings) {
  const type = cell.getAttribute("t") || "";
  if (type === "inlineStr") {
    return [...cell.querySelectorAll("is t")].map(node => node.textContent || "").join("");
  }

  const value = cell.querySelector("v")?.textContent || "";
  if (type === "s") return sharedStrings[Number(value)] || "";
  return value;
}

function xmlDocument(text) {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("The Excel file contains invalid XML.");
  return document;
}

function findEndOfCentralDirectory(bytes) {
  const minOffset = Math.max(0, bytes.length - 66000);
  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (
      bytes[offset] === 0x50
      && bytes[offset + 1] === 0x4b
      && bytes[offset + 2] === 0x05
      && bytes[offset + 3] === 0x06
    ) {
      return offset;
    }
  }
  throw new Error("The Excel file is not a valid .xlsx workbook.");
}

function setDosDateTime(view, offset) {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  view.setUint16(offset, time, true);
  view.setUint16(offset + 2, date, true);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[index]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

function concatBytes(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  parts.forEach(part => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function columnName(columnNumber) {
  let number = columnNumber;
  let name = "";
  while (number > 0) {
    const remainder = (number - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    number = Math.floor((number - 1) / 26);
  }
  return name;
}

function columnIndexFromRef(ref) {
  const letters = /^([A-Z]+)/i.exec(ref)?.[1] || "A";
  return [...letters.toUpperCase()].reduce((total, letter) =>
    (total * 26) + letter.charCodeAt(0) - 64, 0) - 1;
}

function sanitizeSheetName(sheetName) {
  return String(sheetName || "Export")
    .replace(/[\[\]:*?/\\]/g, " ")
    .slice(0, 31)
    .trim() || "Export";
}

function encodeText(value) {
  return encoder.encode(String(value ?? ""));
}

function decodeBytes(bytes) {
  return decoder.decode(bytes);
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
