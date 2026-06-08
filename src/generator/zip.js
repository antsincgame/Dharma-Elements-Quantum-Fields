// 📦 Minimal ZIP writer (store / no compression) — zero-dependency, browser + Node.
//
// Packs the assembled site into a single .zip so the UI can offer a one-click
// download. Implements just enough of the ZIP spec (PKWARE APPNOTE): a local file
// header + data per entry, a central directory, and the end-of-central-directory
// record. Files are STORED (method 0), so no compression library is needed; a
// standard CRC-32 is computed per entry. Output is a Uint8Array ready for a Blob.

const _enc = new TextEncoder();

// Standard CRC-32 (reflected, polynomial 0xEDB88320). crc32("123456789") = 0xCBF43926.
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pushU16(arr, v) { arr.push(v & 0xff, (v >>> 8) & 0xff); }
function pushU32(arr, v) { arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff); }
function pushBytes(arr, b) { for (let i = 0; i < b.length; i++) arr.push(b[i]); }

// entries: [{ name, content }] where content is a string or Uint8Array.
// Returns a Uint8Array containing a valid (stored) ZIP archive.
export function makeZip(entries) {
  const out = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const name = _enc.encode(entry.name);
    const data = typeof entry.content === 'string' ? _enc.encode(entry.content) : entry.content;
    const crc = crc32(data);
    const flags = 0x0800; // bit 11: filename/comment are UTF-8

    // ---- Local file header ----
    const lh = [];
    pushU32(lh, 0x04034b50);
    pushU16(lh, 20);            // version needed to extract (2.0)
    pushU16(lh, flags);
    pushU16(lh, 0);             // compression method: 0 = stored
    pushU16(lh, 0);             // mod time
    pushU16(lh, 0x21);          // mod date (1980-01-01)
    pushU32(lh, crc);
    pushU32(lh, data.length);   // compressed size
    pushU32(lh, data.length);   // uncompressed size
    pushU16(lh, name.length);
    pushU16(lh, 0);             // extra field length
    pushBytes(lh, name);

    pushBytes(out, lh);
    pushBytes(out, data);

    // ---- Central directory header (kept for the trailer) ----
    pushU32(central, 0x02014b50);
    pushU16(central, 20);       // version made by
    pushU16(central, 20);       // version needed
    pushU16(central, flags);
    pushU16(central, 0);        // compression
    pushU16(central, 0);        // mod time
    pushU16(central, 0x21);     // mod date
    pushU32(central, crc);
    pushU32(central, data.length);
    pushU32(central, data.length);
    pushU16(central, name.length);
    pushU16(central, 0);        // extra
    pushU16(central, 0);        // comment
    pushU16(central, 0);        // disk number start
    pushU16(central, 0);        // internal attrs
    pushU32(central, 0);        // external attrs
    pushU32(central, offset);   // relative offset of local header
    pushBytes(central, name);

    offset += lh.length + data.length;
  }

  const centralOffset = offset;
  pushBytes(out, central);

  // ---- End of central directory record ----
  const eocd = [];
  pushU32(eocd, 0x06054b50);
  pushU16(eocd, 0);                 // disk number
  pushU16(eocd, 0);                 // disk with central dir
  pushU16(eocd, entries.length);    // records on this disk
  pushU16(eocd, entries.length);    // total records
  pushU32(eocd, central.length);    // size of central directory
  pushU32(eocd, centralOffset);     // offset of central directory
  pushU16(eocd, 0);                 // comment length
  pushBytes(out, eocd);

  return Uint8Array.from(out);
}
