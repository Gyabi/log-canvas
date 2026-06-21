use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
};

/// Total byte length of a DLT storage header.
const STORAGE_HEADER_LEN: u64 = 16;

/// Scan `path` and return the byte offset of every valid DLT message storage header.
///
/// The returned `Vec<u64>` serves as a random-access index: call [`crate::parse_row_at`]
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
