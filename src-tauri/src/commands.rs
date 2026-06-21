use std::{collections::HashMap, fs::File, sync::Mutex};

use dlt_parser::{DltFileInfo, DltFileState, DltFilter, DltRow};
use tauri::State;

/// Tauri-managed application state shared across all commands.
pub struct AppState {
    /// Raw offset index for every opened DLT file, keyed by absolute path.
    pub dlt_files: Mutex<HashMap<String, DltFileState>>,
    /// Derived views produced by [`create_view`], keyed by a UUID assigned on creation.
    pub dlt_views: Mutex<HashMap<String, DltView>>,
}

/// A derived view: a filtered subset of one physical DLT file's offsets.
pub struct DltView {
    /// Absolute path of the underlying file (used for I/O).
    pub file_id: String,
    /// Byte offsets of messages that passed the filter, in file order.
    pub offsets: Vec<u64>,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Resolve `view_id` to `(file_path, byte_offsets)`, checking derived views first.
fn resolve_view(
    view_id: &str,
    files: &HashMap<String, DltFileState>,
    views: &HashMap<String, DltView>,
) -> Result<(String, Vec<u64>), String> {
    if let Some(v) = views.get(view_id) {
        return Ok((v.file_id.clone(), v.offsets.clone()));
    }
    if let Some(f) = files.get(view_id) {
        return Ok((f.path.clone(), f.offsets.clone()));
    }
    Err(format!("unknown view: {view_id}"))
}

// ── Commands ─────────────────────────────────────────────────────────────────

#[specta::specta]
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {name}! You've been greeted from Rust!")
}

/// Open a DLT file, build a message-offset index, and return file metadata.
///
/// `file_id` is a UUID supplied by the caller (via `crypto.randomUUID()` on the
/// frontend) so that multiple sessions opening the same physical file each get a
/// distinct key in [`AppState`].
#[specta::specta]
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn open_dlt_file(
    path: &str,
    file_id: String,
    state: State<'_, AppState>,
) -> Result<DltFileInfo, String> {
    let offsets = dlt_parser::index_file(path)?;
    let row_count = u32::try_from(offsets.len()).map_err(|e| e.to_string())?;
    state
        .dlt_files
        .lock()
        .map_err(|e| format!("lock poisoned: {e}"))?
        .insert(file_id.clone(), DltFileState { path: path.to_owned(), offsets });
    Ok(DltFileInfo { id: file_id, row_count, path: path.to_owned() })
}

/// Fetch a contiguous range of parsed DLT rows from a view (source or derived).
///
/// `view_id` is either a `file_id` (from [`open_dlt_file`]) or a `view_id`
/// (from [`create_view`]). Derived views are checked first.
/// `offset` is the zero-based row index within the view; `count` is the page size.
/// Rows that fail to parse are silently skipped.
#[specta::specta]
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
#[allow(clippy::significant_drop_tightening)]
pub fn get_log_rows(
    view_id: &str,
    offset: u32,
    count: u32,
    state: State<'_, AppState>,
) -> Result<Vec<DltRow>, String> {
    // Collect path + relevant offsets under lock, then drop the locks before I/O.
    let (path, message_offsets) = {
        let files = state.dlt_files.lock().map_err(|e| format!("lock poisoned: {e}"))?;
        let views = state.dlt_views.lock().map_err(|e| format!("lock poisoned: {e}"))?;
        let (path, all_offsets) = resolve_view(view_id, &files, &views)?;
        let start = offset as usize;
        let end = start.saturating_add(count as usize).min(all_offsets.len());
        let relevant = all_offsets.get(start..end).unwrap_or(&[]).to_vec();
        (path, relevant)
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

/// Apply `filters` (AND-combined) to a source view and store the result as a new
/// derived view identified by `view_id`.
///
/// If a derived view with `view_id` already exists it is replaced.
/// `source_view_id` can be a file ID (source) or another derived view ID (chaining).
/// Returns the filtered row count.
#[specta::specta]
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn create_view(
    view_id: String,
    source_view_id: String,
    filters: Vec<DltFilter>,
    state: State<'_, AppState>,
) -> Result<u32, String> {
    // Resolve source under lock, clone data, then release lock before heavy I/O.
    let (file_id, source_offsets) = {
        let files = state.dlt_files.lock().map_err(|e| format!("lock poisoned: {e}"))?;
        let views = state.dlt_views.lock().map_err(|e| format!("lock poisoned: {e}"))?;
        resolve_view(&source_view_id, &files, &views)?
    };

    let filtered = dlt_parser::apply_filters(&source_offsets, &file_id, &filters)?;
    let row_count = u32::try_from(filtered.len()).map_err(|e| e.to_string())?;

    state
        .dlt_views
        .lock()
        .map_err(|e| format!("lock poisoned: {e}"))?
        .insert(view_id, DltView { file_id, offsets: filtered });

    Ok(row_count)
}

/// Remove an opened DLT file from [`AppState`], freeing its offset index.
///
/// Should be called when the corresponding `SourceLogViewNode` is deleted.
/// Silently succeeds if `file_id` does not exist.
#[specta::specta]
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn close_dlt_file(file_id: String, state: State<'_, AppState>) -> Result<(), String> {
    state
        .dlt_files
        .lock()
        .map_err(|e| format!("lock poisoned: {e}"))?
        .remove(&file_id);
    Ok(())
}

/// Remove a derived view from [`AppState`], freeing its offset index.
///
/// Silently succeeds if `view_id` does not exist.
#[specta::specta]
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn delete_view(view_id: String, state: State<'_, AppState>) -> Result<(), String> {
    state
        .dlt_views
        .lock()
        .map_err(|e| format!("lock poisoned: {e}"))?
        .remove(&view_id);
    Ok(())
}

/// Given a derived view and a zero-based row index within it, return the
/// corresponding zero-based row index in `source_view_id`.
///
/// Used by the UI to jump to the matching row in a parent view on double-click.
#[specta::specta]
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
#[allow(clippy::significant_drop_tightening)]
pub fn get_source_row_index(
    derived_view_id: String,
    derived_row_index: u32,
    source_view_id: String,
    state: State<'_, AppState>,
) -> Result<u32, String> {
    let (byte_offset, source_offsets) = {
        let files = state.dlt_files.lock().map_err(|e| format!("lock poisoned: {e}"))?;
        let views = state.dlt_views.lock().map_err(|e| format!("lock poisoned: {e}"))?;
        let derived = views
            .get(&derived_view_id)
            .ok_or_else(|| format!("unknown derived view: {derived_view_id}"))?;
        let slot = usize::try_from(derived_row_index).map_err(|e| e.to_string())?;
        let &byte_offset = derived
            .offsets
            .get(slot)
            .ok_or_else(|| format!("row {derived_row_index} out of range"))?;
        let (_file_id, source_offsets) = resolve_view(&source_view_id, &files, &views)?;
        (byte_offset, source_offsets)
    };
    let pos = source_offsets
        .binary_search(&byte_offset)
        .map_err(|_| format!("byte offset {byte_offset} not found in source view"))?;
    u32::try_from(pos).map_err(|e| e.to_string())
}
