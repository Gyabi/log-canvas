use serde::{Deserialize, Serialize};
use specta::Type;

/// A single parsed DLT log row returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DltRow {
    /// Zero-based row index within the view.
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
