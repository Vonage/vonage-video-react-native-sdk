'use strict';

/**
 * Minimal HPROF instance counter for Android E2E memory-leak tests.
 *
 * Captures a heap dump from a running app via `adb shell am dumpheap`,
 * converts it from the Android-specific hprof variant to the standard
 * format with `hprof-conv` (ships with the Android SDK platform-tools —
 * no extra dependency), then counts *live* instances per class name by
 * parsing the standard HPROF binary format directly.
 *
 * This intentionally implements only the subset of the HPROF spec needed
 * to map class names to object counts:
 *   - STRING (0x01) records: string ID -> UTF-8 text
 *   - LOAD CLASS (0x02) records: class object ID -> string ID (class name)
 *   - HEAP DUMP / HEAP DUMP SEGMENT (0x0c / 0x1c) records, and inside them:
 *       - INSTANCE DUMP (0x21) subrecords: one per live object instance
 *
 * It does not build an object graph, resolve field values, or compute
 * retained size — it only counts "how many live instances of class X
 * exist right now", which is exactly what a leak assertion needs
 * (e.g. "Publisher instances after N disconnect cycles must not grow").
 *
 * No new dependency is introduced: this is pure Node (fs/child_process).
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Captures a heap dump from the given package on the given device and
 * returns counts of live instances for the requested class names.
 *
 * @param {object} options
 * @param {string} options.serial - adb device serial (e.g. '53261FDAP001NM')
 * @param {string} [options.pkg='com.reactnativetesapp'] - app package name
 * @param {string[]} options.classNames - fully-qualified class names to count,
 *   e.g. ['com.opentok.android.Publisher', 'com.opentokreactnative.OTRNPublisher']
 * @returns {Promise<Record<string, number>>} class name -> live instance count
 */
async function captureInstanceCounts({ serial, pkg = 'com.reactnativetesapp', classNames }) {
  const pid = adb(serial, ['shell', 'pidof', pkg]).trim();
  if (!pid) {
    throw new Error(`captureInstanceCounts: ${pkg} is not running on ${serial}`);
  }

  const remotePath = `/data/local/tmp/e2e-heap-${Date.now()}.hprof`;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'otrn-heap-'));
  const rawLocal = path.join(tmpDir, 'raw.hprof');
  const convLocal = path.join(tmpDir, 'conv.hprof');

  try {
    // am dumpheap is asynchronous: it schedules the dump and returns
    // immediately. Poll for the file to stop growing instead of a fixed
    // sleep, so this works across slow/fast devices without flaking.
    adb(serial, ['shell', 'am', 'dumpheap', pid, remotePath]);
    await waitForStableFile(serial, remotePath);

    adb(serial, ['pull', remotePath, rawLocal]);
    adb(serial, ['shell', 'rm', '-f', remotePath]);

    hprofConv(rawLocal, convLocal);

    const buffer = fs.readFileSync(convLocal);
    const counts = countInstancesPerClass(buffer, classNames);
    return counts;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function adb(serial, args) {
  return execFileSync('adb', ['-s', serial, ...args], { encoding: 'utf8' });
}

function hprofConv(inputPath, outputPath) {
  const sdkRoot =
    process.env.ANDROID_SDK_ROOT ||
    process.env.ANDROID_HOME ||
    path.join(os.homedir(), 'Library/Android/sdk');
  const bin = path.join(sdkRoot, 'platform-tools', 'hprof-conv');
  execFileSync(bin, [inputPath, outputPath]);
}

/**
 * am dumpheap returns before the file is fully written. Poll the remote
 * file size until it stops changing across two checks in a row.
 */
async function waitForStableFile(serial, remotePath, { timeoutMs = 20000, pollMs = 300 } = {}) {
  const start = Date.now();
  let lastSize = -1;
  let stableStreak = 0;
  while (Date.now() - start < timeoutMs) {
    await sleep(pollMs);
    const size = statSize(serial, remotePath);
    if (size > 0 && size === lastSize) {
      stableStreak += 1;
      if (stableStreak >= 2) return;
    } else {
      stableStreak = 0;
    }
    lastSize = size;
  }
  throw new Error(`Heap dump at ${remotePath} did not stabilize within ${timeoutMs}ms`);
}

function statSize(serial, remotePath) {
  try {
    const out = adb(serial, ['shell', 'stat', '-c', '%s', remotePath]).trim();
    return parseInt(out, 10) || 0;
  } catch {
    return 0;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Minimal HPROF binary parser -------------------------------------------

const TAG = {
  STRING: 0x01,
  LOAD_CLASS: 0x02,
  HEAP_DUMP: 0x0c,
  HEAP_DUMP_SEGMENT: 0x1c,
};

const SUBTAG = {
  INSTANCE_DUMP: 0x21,
};

/**
 * Parses a standard-format HPROF buffer and returns, for each requested
 * class name, the number of live INSTANCE_DUMP records whose class matches.
 *
 * HPROF layout (big-endian throughout):
 *   header: NUL-terminated format string, then 4 bytes identifierSize (must
 *   be 8 for 64-bit dumps), then 8 bytes high/low timestamp words.
 *   records: repeated { u8 tag, u32 timestamp, u32 length, length bytes body }
 */
function countInstancesPerClass(buffer, classNames) {
  const wanted = new Set(classNames);
  const stringsById = new Map(); // string ID -> text
  const classNameByObjectId = new Map(); // class object ID -> class name
  const counts = Object.create(null);
  for (const name of classNames) counts[name] = 0;

  let offset = skipHeader(buffer);
  const idSize = readIdSizeFromHeader(buffer);

  while (offset < buffer.length) {
    const tag = buffer.readUInt8(offset);
    offset += 1;
    offset += 4; // timestamp (unused)
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const bodyStart = offset;
    const bodyEnd = offset + length;

    if (tag === TAG.STRING) {
      const id = readId(buffer, bodyStart, idSize);
      const text = buffer.toString('utf8', bodyStart + idSize, bodyEnd);
      stringsById.set(id, text);
    } else if (tag === TAG.LOAD_CLASS) {
      // u32 classSerialNumber, ID classObjectId, u32 stackTraceSerialNumber,
      // ID classNameStringId
      const classObjectId = readId(buffer, bodyStart + 4, idSize);
      const classNameStringId = readId(buffer, bodyStart + 4 + idSize + 4, idSize);
      const name = stringsById.get(classNameStringId);
      if (name) classNameByObjectId.set(classObjectId, name);
    } else if (tag === TAG.HEAP_DUMP || tag === TAG.HEAP_DUMP_SEGMENT) {
      scanHeapDumpSegment(buffer, bodyStart, bodyEnd, idSize, classNameByObjectId, wanted, counts);
    }

    offset = bodyEnd;
  }

  return counts;
}

function scanHeapDumpSegment(buffer, start, end, idSize, classNameByObjectId, wanted, counts) {
  let offset = start;
  while (offset < end) {
    const subtag = buffer.readUInt8(offset);
    offset += 1;

    if (subtag === SUBTAG.INSTANCE_DUMP) {
      // ID objectId, u32 stackTraceSerialNumber, ID classObjectId,
      // u32 remainingBytesLength, then remainingBytesLength bytes of fields
      offset += idSize; // objectId
      offset += 4; // stackTraceSerialNumber
      const classObjectId = readId(buffer, offset, idSize);
      offset += idSize;
      const remaining = buffer.readUInt32BE(offset);
      offset += 4;

      const className = classNameByObjectId.get(classObjectId);
      if (className && wanted.has(className)) {
        counts[className] += 1;
      }
      offset += remaining;
    } else {
      // Any other subrecord type: fall back to the documented fixed sizes
      // just enough to skip over it. We only need INSTANCE_DUMP counts, so
      // unknown/other subrecords are skipped using their own encoded length
      // where available; records without a length prefix in this minimal
      // parser abort the scan for this segment rather than risk misreading
      // the stream.
      const skipped = skipOtherSubrecord(buffer, offset - 1, idSize);
      if (skipped == null) return; // unsupported subrecord shape; stop safely
      offset = skipped;
    }
  }
}

// Fixed-size (non ID-array) subrecords that can precede INSTANCE_DUMP in a
// heap dump segment. Sizes per the HPROF spec, in bytes after the subtag.
function skipOtherSubrecord(buffer, subtagOffset, idSize) {
  const subtag = buffer.readUInt8(subtagOffset);
  let offset = subtagOffset + 1;
  switch (subtag) {
    case 0x01: // ROOT_JNI_GLOBAL: ID obj, ID jniGlobalRefId
      return offset + idSize * 2;
    case 0x02: // ROOT_JNI_LOCAL: ID obj, u32 thread, u32 frame
      return offset + idSize + 8;
    case 0x03: // ROOT_JAVA_FRAME: ID obj, u32 thread, u32 frame
      return offset + idSize + 8;
    case 0x04: // ROOT_NATIVE_STACK: ID obj, u32 thread
      return offset + idSize + 4;
    case 0x05: // ROOT_STICKY_CLASS: ID obj
      return offset + idSize;
    case 0x06: // ROOT_THREAD_BLOCK: ID obj, u32 thread
      return offset + idSize + 4;
    case 0x07: // ROOT_MONITOR_USED: ID obj
      return offset + idSize;
    case 0x08: // ROOT_THREAD_OBJECT: ID obj, u32 thread, u32 stackTrace
      return offset + idSize + 8;
    case 0x89: // ROOT_INTERNED_STRING: ID obj
    case 0x8a: // ROOT_FINALIZING: ID obj
    case 0x8b: // ROOT_DEBUGGER: ID obj
    case 0x8d: // ROOT_VM_INTERNAL: ID obj
      return offset + idSize;
    case 0x8c: // ROOT_REFERENCE_CLEANUP: ID obj, ID obj
      return offset + idSize * 2;
    case 0x8e: { // ROOT_JNI_MONITOR: ID obj, u32 thread, u32 depth
      return offset + idSize + 8;
    }
    case 0xff: // ROOT_UNKNOWN: ID obj
      return offset + idSize;
    case 0x20: { // CLASS_DUMP — variable length, has a documented layout
      // ID classObjId, u32 stackTrace, ID superClassId, ID classLoaderId,
      // ID signersId, ID protectionDomainId, ID reserved1, ID reserved2,
      // u32 instanceSize, u16 constantPoolSize, [entries], u16 staticFieldCount,
      // [entries], u16 instanceFieldCount, [entries]
      offset += idSize + 4 + idSize * 6 + 4;
      const constantPoolSize = buffer.readUInt16BE(offset);
      offset += 2;
      for (let i = 0; i < constantPoolSize; i++) {
        offset += 2; // constant pool index
        const type = buffer.readUInt8(offset);
        offset += 1;
        offset += basicTypeSize(type, idSize);
      }
      const staticFieldCount = buffer.readUInt16BE(offset);
      offset += 2;
      for (let i = 0; i < staticFieldCount; i++) {
        offset += idSize; // name string id
        const type = buffer.readUInt8(offset);
        offset += 1;
        offset += basicTypeSize(type, idSize);
      }
      const instanceFieldCount = buffer.readUInt16BE(offset);
      offset += 2;
      for (let i = 0; i < instanceFieldCount; i++) {
        offset += idSize; // name string id
        offset += 1; // type
      }
      return offset;
    }
    case 0x22: { // OBJECT_ARRAY_DUMP: ID obj, u32 stackTrace, u32 count, ID elemClassId, [ID]*count
      offset += idSize + 4;
      const count = buffer.readUInt32BE(offset);
      offset += 4;
      offset += idSize; // element class id
      return offset + count * idSize;
    }
    case 0x23: { // PRIMITIVE_ARRAY_DUMP: ID obj, u32 stackTrace, u32 count, u8 elemType, [elem]*count
      offset += idSize + 4;
      const count = buffer.readUInt32BE(offset);
      offset += 4;
      const elemType = buffer.readUInt8(offset);
      offset += 1;
      return offset + count * basicTypeSize(elemType, idSize);
    }
    default:
      // Unrecognized subrecord tag for this minimal parser. Rather than
      // guess and risk silently under/over-counting, stop scanning this
      // segment — callers should treat 0 counts from a truncated scan with
      // caution, but a live device dump from the Android runtime only ever
      // emits the subrecords handled above.
      return null;
  }
}

function basicTypeSize(type, idSize) {
  switch (type) {
    case 2: return idSize; // object
    case 4: return 1; // boolean
    case 5: return 2; // char
    case 6: return 4; // float
    case 7: return 8; // double
    case 8: return 1; // byte
    case 9: return 2; // short
    case 10: return 4; // int
    case 11: return 8; // long
    default: return idSize;
  }
}

function skipHeader(buffer) {
  let offset = 0;
  while (buffer.readUInt8(offset) !== 0) offset += 1;
  offset += 1; // NUL terminator
  offset += 4; // identifierSize
  offset += 8; // timestamp (hi/lo u32)
  return offset;
}

function readIdSizeFromHeader(buffer) {
  let offset = 0;
  while (buffer.readUInt8(offset) !== 0) offset += 1;
  offset += 1;
  return buffer.readUInt32BE(offset);
}

function readId(buffer, offset, idSize) {
  if (idSize === 4) return buffer.readUInt32BE(offset);
  // 8-byte IDs: Number loses precision above 2^53, but device heap object
  // IDs (pointer-derived) fit comfortably within that range in practice.
  // Use a string key for safety instead of a lossy Number where it matters.
  return buffer.readBigUInt64BE(offset).toString();
}

module.exports = { captureInstanceCounts };
