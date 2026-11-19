#!/usr/bin/env node
//  Copyright (C) 2026 DefKorns
//
//  This program is free software; you can redistribute it and/or
//  modify it under the terms of the GNU General Public License
//  as published by the Free Software Foundation; either version 3
//  of the License, or (at your option) any later version.

'use strict';

const fs = require('fs');

const DATA_BEHIND_HEADER = 0x3c;
const HEADER_SIZE = 8;
const MAX_RECORD_LEN = 0x100;
const DEFAULT_SCAN_FROM = 0x58000;
const IPS_MAX_OFFSET = 0xffffff;
const INES_HEADER_SIZE = 16;

function parseNumber(text) {
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0) throw new Error(`bad number: ${text}`);
  return value;
}

function parseRange(text) {
  const parts = text.split('-');
  if (parts.length !== 2) throw new Error(`bad range: ${text}`);
  return { lo: parseNumber(parts[0]), hi: parseNumber(parts[1]) };
}

function isZeroRun(buf, at) {
  return buf[at] === 0 && buf[at + 1] === 0 && buf[at + 2] === 0 && buf[at + 3] === 0;
}

function findRecords(bin, scanFrom, maxOffset) {
  const records = [];
  const end = bin.length - HEADER_SIZE;
  let i = scanFrom;
  while (i < end) {
    while (i < end && bin[i] === 0) i++;
    const start = i;
    while (i < end && !isZeroRun(bin, i)) i++;
    const chunkLen = i - start;
    if (chunkLen < HEADER_SIZE || start < DATA_BEHIND_HEADER) continue;

    const offset = bin.readUInt32LE(start);
    const length = bin.readUInt32LE(start + 4);
    const plausible = length > 0 && length <= MAX_RECORD_LEN &&
      offset + length <= maxOffset &&
      chunkLen - HEADER_SIZE <= DATA_BEHIND_HEADER + length;
    if (!plausible) continue;

    const dataAt = start - DATA_BEHIND_HEADER;
    records.push({ header: start, offset, length, data: bin.subarray(dataAt, dataAt + length) });
  }
  return records;
}

function similarity(record, base) {
  if (record.offset + record.length > base.length) return 0;
  let same = 0;
  for (let k = 0; k < record.length; k++) {
    if (base[record.offset + k] === record.data[k]) same++;
  }
  return same / record.length;
}

function buildIps(records, shift) {
  const parts = [Buffer.from('PATCH')];
  for (const r of records) {
    const offset = r.offset - shift;
    if (offset < 0 || offset > IPS_MAX_OFFSET) throw new Error(`offset out of range: 0x${r.offset.toString(16)}`);
    parts.push(
      Buffer.from([offset >> 16, (offset >> 8) & 0xff, offset & 0xff, r.length >> 8, r.length & 0xff]),
      r.data,
    );
  }
  parts.push(Buffer.from('EOF'));
  return Buffer.concat(parts);
}

function applyRecords(base, records) {
  const out = Buffer.from(base);
  for (const r of records) r.data.copy(out, r.offset);
  return out;
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--unheadered') options.unheadered = true;
    else if (arg === '--hdr' || arg === '--scan-from') options[arg.slice(2)] = argv[++i];
    else positional.push(arg);
  }
  return { positional, options };
}

function loadRecords(binPath, basePath, options) {
  const bin = fs.readFileSync(binPath);
  const base = fs.readFileSync(basePath);
  const scanFrom = options['scan-from'] ? parseNumber(options['scan-from']) : DEFAULT_SCAN_FROM;
  let records = findRecords(bin, scanFrom, base.length);
  if (options.hdr) {
    const { lo, hi } = parseRange(options.hdr);
    records = records.filter((r) => r.header >= lo && r.header <= hi);
  }
  return { base, records };
}

function usage() {
  console.error(
    'usage:\n' +
    '  kpatch.js list <kachikachi> <base_rom> [--hdr LO-HI] [--scan-from N]\n' +
    '  kpatch.js ips  <kachikachi> <base_rom> <out.ips> [--hdr LO-HI] [--scan-from N] [--unheadered]\n' +
    '  kpatch.js apply <kachikachi> <base_rom> <out_rom> [--hdr LO-HI] [--scan-from N]',
  );
  process.exit(2);
}

function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  const [command, binPath, basePath, outPath] = positional;
  if (!command || !binPath || !basePath) usage();

  const { base, records } = loadRecords(binPath, basePath, options);

  if (command === 'list') {
    for (const r of records) {
      const sim = (similarity(r, base) * 100).toFixed(0).padStart(3);
      console.log(`hdr=0x${r.header.toString(16)} off=0x${r.offset.toString(16)} len=${r.length} similar=${sim}%`);
    }
    console.log(`${records.length} records`);
    return;
  }

  if (!outPath) usage();

  if (command === 'ips') {
    const shift = options.unheadered ? INES_HEADER_SIZE : 0;
    const ips = buildIps(records, shift);
    fs.writeFileSync(outPath, ips);
    console.log(`${records.length} records, ${ips.length} bytes`);
  } else if (command === 'apply') {
    fs.writeFileSync(outPath, applyRecords(base, records));
    console.log(`${records.length} records applied`);
  } else {
    usage();
  }
}

main();
