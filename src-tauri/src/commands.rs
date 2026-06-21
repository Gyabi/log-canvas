use std::{collections::HashMap, fs::File, sync::Mutex};

use dlt_parser::{DltFileInfo, DltFileState, DltRow};
use tauri::State;

/// Tauri-managed application state shared across all commands.
pub struct AppState {
    /// Index of open DLT files, keyed by absolute file path.
    pub dlt_files: Mutex<HashMap<String, DltFileState>>,
}

#[specta::specta]
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {name}! You've been greeted from Rust!")
}

/// Open a DLT file, build a message-offset index, and return file metadata.
///
/// The indexed state is stored in [`AppState`] and referenced by subsequent
/// [`get_log_rows`] calls using the returned `id` field (which equals `path`).
#[specta::specta]
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn open_dlt_file(
    path: &str,
    state: State<'_, AppState>,
) -> Result<DltFileInfo, String> {
    let offsets = dlt_parser::index_file(path)?;
    let row_count = u32::try_from(offsets.len()).map_err(|e| e.to_string())?;
    let id = path.to_owned();
    state
        .dlt_files
        .lock()
        .map_err(|e| format!("lock poisoned: {e}"))?
        .insert(id.clone(), DltFileState { path: path.to_owned(), offsets });
    Ok(DltFileInfo { id, row_count, path: path.to_owned() })
}

/// Fetch a contiguous range of parsed DLT rows from a previously opened file.
///
/// `file_id` must match the `id` returned by [`open_dlt_file`].
/// `offset` is the zero-based index of the first row; `count` is the page size.
/// Rows that fail to parse are silently skipped.
#[specta::specta]
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
#[allow(clippy::significant_drop_tightening)]
pub fn get_log_rows(
    file_id: &str,
    offset: u32,
    count: u32,
    state: State<'_, AppState>,
) -> Result<Vec<DltRow>, String> {
    // Collect path + relevant offsets under lock, then drop the lock before file I/O.
    let (path, message_offsets) = {
        let guard = state
            .dlt_files
            .lock()
            .map_err(|e| format!("lock poisoned: {e}"))?;
        let fs = guard
            .get(file_id)
            .ok_or_else(|| format!("unknown file: {file_id}"))?;
        let start = offset as usize;
        let end = start.saturating_add(count as usize).min(fs.offsets.len());
        let relevant = fs.offsets.get(start..end).unwrap_or(&[]).to_vec();
        (fs.path.clone(), relevant)
    };

    let mut file = File::open(&path).map_err(|e| format!("cannot open file: {e}"))?;
    let mut rows = Vec::with_capacity(message_offsets.len());
    for (i, &storage_offset) in message_offsets.iter().enumerate() {
        let row_index = offset.saturating_add(u32::try_from(i).unwrap_or(u32::MAX));
        if let Ok(row) = dlt_parser::parse_row_at(&mut file, storage_offset, row_index) {
            rows.push(row);
        }
    }
    Ok(rows)
}
