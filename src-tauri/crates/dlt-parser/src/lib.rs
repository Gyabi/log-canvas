//! DLT (Diagnostic Log and Trace) file parser.
//!
//! Parses the DLT Storage Format defined by AUTOSAR/COVESA.
//! Two-phase access: index the file once with [`index_file`], then fetch rows
//! on demand with [`parse_row_at`].

#![allow(clippy::module_name_repetitions)]

use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
};

use serde::{Deserialize, Serialize};
use specta::Type;

/// Total byte length of a DLT storage header.
const STORAGE_HEADER_LEN: u64 = 16;

// Standard header HTYP byte bit masks.
const HTYP_UEH:  u8 = 0x01; // Use Extended Header
const HTYP_MSBF: u8 = 0x02; // Most Significant Byte First (big-endian payload)
const HTYP_WEID: u8 = 0x04; // With ECU ID
const HTYP_WSID: u8 = 0x08; // With Session ID
const HTYP_WTMS: u8 = 0x10; // With Timestamp

// Extended header MSIN byte bit masks.
const MSIN_MSTP: u8 = 0x0E; // Message Type (bits 1–3)
const MSIN_MTIN: u8 = 0xF0; // Message Type Info (bits 4–7)

/// A single parsed DLT log row returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DltRow {
    /// Zero-based row index within the file.
    pub index: u32,
    /// Absolute timestamp in microseconds (storage-header seconds × 10⁶ + microseconds).
    /// Stored as `f64` so specta exports it as TypeScript `number` without `BigInt` issues.
    pub timestamp_us: f64,
    /// ECU identifier (WEID field when present, otherwise storage-header ECU ID).
    pub ecu_id: String,
    /// Application identifier from the extended header APID field.
    pub app_id: String,
    /// Context identifier from the extended header CTID field.
    pub ctx_id: String,
    /// Message type: `"LOG"`, `"TRACE"`, `"NETWORK"`, or `"CONTROL"`.
    pub msg_type: String,
    /// Log level for LOG messages: `"FATAL"`, `"ERROR"`, `"WARN"`, `"INFO"`, `"DEBUG"`, `"VERBOSE"`.
    pub level: String,
    /// Decoded payload content.
    pub payload: String,
}

/// Metadata returned to the frontend when a DLT file is successfully opened.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DltFileInfo {
    /// File session identifier (equals the absolute file path).
    pub id: String,
    /// Total number of valid DLT messages found in the file.
    pub row_count: u32,
    /// Absolute path to the file on disk.
    pub path: String,
}

/// Runtime index for a single open DLT file.
pub struct DltFileState {
    /// Absolute path to the file.
    pub path: String,
    /// Byte offset of each valid message's storage header within the file.
    pub offsets: Vec<u64>,
}

/// Scan `path` and return the byte offset of every valid DLT message storage header.
///
/// The returned `Vec<u64>` serves as a random-access index: call [`parse_row_at`]
/// with `offsets[i]` to parse message `i` without re-scanning the file.
///
/// # Errors
///
/// Returns an error string if the file cannot be opened, stat-ed, or read.
pub fn index_file(path: &str) -> Result<Vec<u64>, String> {
    let mut file = File::open(path).map_err(|e| format!("cannot open {path}: {e}"))?;
    let file_len = file
        .metadata()
        .map_err(|e| format!("stat failed: {e}"))?
        .len();

    let mut offsets = Vec::new();
    let mut pos: u64 = 0;
    // We need at least 20 bytes: 16 (storage header) + 4 (minimal standard header).
    let mut buf = [0u8; 20];

    while pos.saturating_add(20) <= file_len {
        file.seek(SeekFrom::Start(pos))
            .map_err(|e| format!("seek error at {pos}: {e}"))?;

        let n = file
            .read(&mut buf)
            .map_err(|e| format!("read error at {pos}: {e}"))?;
        if n < 20 {
            break;
        }

        if !buf.starts_with(b"DLT\x01") {
            pos += 1;
            continue;
        }

        // Standard header `len` field: big-endian u16 at bytes 18–19 relative to storage start.
        let std_len = u64::from(u16::from_be_bytes([buf[18], buf[19]]));
        if std_len < 4 {
            // Minimum standard header is 4 bytes; reject malformed messages.
            pos += 1;
            continue;
        }

        let msg_end = pos
            .saturating_add(STORAGE_HEADER_LEN)
            .saturating_add(std_len);
        if msg_end > file_len {
            break; // Truncated message — stop scanning.
        }

        offsets.push(pos);
        pos = msg_end;
    }

    Ok(offsets)
}

/// Parse the DLT message whose storage header begins at `storage_offset` within `file`.
///
/// `index` is embedded in the returned [`DltRow`] for display purposes.
///
/// # Errors
///
/// Returns an error string if any header or payload read fails.
pub fn parse_row_at(file: &mut File, storage_offset: u64, index: u32) -> Result<DltRow, String> {
    file.seek(SeekFrom::Start(storage_offset))
        .map_err(|e| format!("seek to {storage_offset}: {e}"))?;

    // ── Storage Header (16 bytes) ────────────────────────────────────────────
    // Layout: magic(4) | seconds(4 LE) | microseconds(4 LE) | ecu_id(4)
    let mut storage = [0u8; 16];
    file.read_exact(&mut storage)
        .map_err(|e| format!("read storage header: {e}"))?;

    let seconds = u32::from_le_bytes([storage[4], storage[5], storage[6], storage[7]]);
    let microseconds = i32::from_le_bytes([storage[8], storage[9], storage[10], storage[11]]);
    let storage_ecu = trim_null_str(&storage[12..16]);

    let timestamp_us = f64::from(seconds).mul_add(1_000_000.0, f64::from(microseconds));

    // ── Standard Header (4 bytes minimum) ───────────────────────────────────
    // Layout: htyp(1) | mcnt(1) | len(2 BE)
    let mut std_min = [0u8; 4];
    file.read_exact(&mut std_min)
        .map_err(|e| format!("read std header: {e}"))?;

    let htyp    = std_min[0];
    let std_len = u16::from_be_bytes([std_min[2], std_min[3]]);

    let use_ext_hdr   = htyp & HTYP_UEH  != 0;
    let has_ecu_id    = htyp & HTYP_WEID != 0;
    let has_session   = htyp & HTYP_WSID != 0;
    let has_timestamp = htyp & HTYP_WTMS != 0;
    let big_endian    = htyp & HTYP_MSBF != 0;

    let mut consumed: u16 = 4;

    // Optional: ECU ID (4 bytes)
    let ecu_id = if has_ecu_id {
        let mut buf = [0u8; 4];
        file.read_exact(&mut buf)
            .map_err(|e| format!("read WEID: {e}"))?;
        consumed += 4;
        trim_null_str(&buf)
    } else {
        storage_ecu
    };

    // Optional: Session ID (4 bytes — advance cursor only)
    if has_session {
        file.seek(SeekFrom::Current(4))
            .map_err(|e| format!("skip WSID: {e}"))?;
        consumed += 4;
    }

    // Optional: Timestamp (4 bytes — we use the absolute storage-header time instead)
    if has_timestamp {
        file.seek(SeekFrom::Current(4))
            .map_err(|e| format!("skip WTMS: {e}"))?;
        consumed += 4;
    }

    // ── Extended Header (10 bytes, when UEH is set) ──────────────────────────
    // Layout: msin(1) | noar(1) | apid(4) | ctid(4)
    let mut app_id   = String::new();
    let mut ctx_id   = String::new();
    let mut msg_type = String::new();
    let mut level    = String::new();

    if use_ext_hdr {
        let mut ext = [0u8; 10];
        file.read_exact(&mut ext)
            .map_err(|e| format!("read ext header: {e}"))?;
        consumed += 10;

        let info_byte    = ext[0];
        let mstp         = (info_byte & MSIN_MSTP) >> 1;
        let log_lvl_bits = (info_byte & MSIN_MTIN) >> 4;

        mstp_to_str(mstp).clone_into(&mut msg_type);
        mtin_to_level(mstp, log_lvl_bits).clone_into(&mut level);
        app_id = trim_null_str(&ext[2..6]);
        ctx_id = trim_null_str(&ext[6..10]);
    }

    // ── Payload ──────────────────────────────────────────────────────────────
    let payload_len = usize::from(std_len.saturating_sub(consumed));
    let payload = if payload_len > 0 {
        let mut buf = vec![0u8; payload_len];
        file.read_exact(&mut buf)
            .map_err(|e| format!("read payload: {e}"))?;
        extract_payload_string(&buf, big_endian)
    } else {
        String::new()
    };

    Ok(DltRow {
        index,
        timestamp_us,
        ecu_id,
        app_id,
        ctx_id,
        msg_type,
        level,
        payload,
    })
}

/// Convert a null-padded byte slice to a trimmed UTF-8 string.
fn trim_null_str(bytes: &[u8]) -> String {
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).trim().to_owned()
}

/// Map a DLT MSTP value to its display name.
const fn mstp_to_str(mstp: u8) -> &'static str {
    match mstp {
        0 => "LOG",
        1 => "TRACE",
        2 => "NETWORK",
        3 => "CONTROL",
        _ => "UNKNOWN",
    }
}

/// Map a DLT MTIN value to a log-level display string.
///
/// Returns an empty string for non-LOG message types (`mstp != 0`).
const fn mtin_to_level(mstp: u8, mtin: u8) -> &'static str {
    if mstp != 0 {
        return "";
    }
    match mtin {
        1 => "FATAL",
        2 => "ERROR",
        3 => "WARN",
        4 => "INFO",
        5 => "DEBUG",
        6 => "VERBOSE",
        _ => "",
    }
}

/// Best-effort extraction of a human-readable string from raw DLT payload bytes.
///
/// Priority:
/// 1. Verbose string argument (`type_info` `DLT_TYPE_INFO_STRG` + 2-byte length prefix).
/// 2. Full payload decoded as UTF-8 with control characters stripped.
/// 3. Hex dump.
fn extract_payload_string(bytes: &[u8], big_endian: bool) -> String {
    if bytes.is_empty() {
        return String::new();
    }

    // Try verbose string argument: 4-byte type_info + 2-byte string length + string data.
    if bytes.len() >= 6 {
        let type_info = if big_endian {
            u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
        } else {
            u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
        };

        // DLT_TYPE_INFO_STRG = bit 9 (0x0200)
        if type_info & 0x0200 != 0 {
            let str_len = if big_endian {
                usize::from(u16::from_be_bytes([bytes[4], bytes[5]]))
            } else {
                usize::from(u16::from_le_bytes([bytes[4], bytes[5]]))
            };
            let end = (6 + str_len).min(bytes.len());
            if let Ok(s) = std::str::from_utf8(&bytes[6..end]) {
                let trimmed = s.trim_matches('\0').trim().to_owned();
                if !trimmed.is_empty() {
                    return trimmed;
                }
            }
        }
    }

    // Fallback: treat entire payload as ASCII/UTF-8, keeping only printable chars.
    let printable: Vec<u8> = bytes
        .iter()
        .copied()
        .filter(|&b| (0x20..0x7F).contains(&b))
        .collect();
    if let Ok(s) = std::str::from_utf8(&printable) {
        let trimmed = s.trim().to_owned();
        if !trimmed.is_empty() {
            return trimmed;
        }
    }

    // Final fallback: hex dump.
    bytes
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<Vec<_>>()
        .join(" ")
}
