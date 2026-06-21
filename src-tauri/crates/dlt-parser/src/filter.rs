use std::fs::File;

use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::{parser::parse_row_at, types::DltRow};

/// A single filter predicate applied to a [`DltRow`] field.
///
/// Multiple filters are AND-combined by [`apply_filters`].
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DltFilter {
    /// Target field: `"ecuId"`, `"appId"`, `"ctxId"`, `"level"`, or `"payload"`.
    pub field: String,
    /// Comparison operator: `"eq"`, `"neq"`, `"contains"`, or `"regex"`.
    pub op: String,
    /// Value to compare against.
    pub value: String,
}

impl DltFilter {
    fn field_value<'r>(&self, row: &'r DltRow) -> &'r str {
        match self.field.as_str() {
            "ecuId"   => &row.ecu_id,
            "appId"   => &row.app_id,
            "ctxId"   => &row.ctx_id,
            "level"   => &row.level,
            "payload" => &row.payload,
            _         => "",
        }
    }

    fn matches_with(&self, row: &DltRow, compiled_re: Option<&Regex>) -> bool {
        let v = self.field_value(row);
        match self.op.as_str() {
            "eq"       => v == self.value,
            "neq"      => v != self.value,
            "contains" => v.contains(self.value.as_str()),
            "regex"    => compiled_re.is_some_and(|re| re.is_match(v)),
            _          => true,
        }
    }
}

/// Scan `source_offsets` from `path`, apply `filters` (AND-combined), and return
/// the byte offsets of matching messages.
///
/// Regex patterns are pre-compiled once before iterating rows for performance.
///
/// # Errors
///
/// Returns an error string if the file cannot be opened or a `"regex"` filter
/// contains an invalid pattern.
pub fn apply_filters(
    source_offsets: &[u64],
    path: &str,
    filters: &[DltFilter],
) -> Result<Vec<u64>, String> {
    if filters.is_empty() {
        return Ok(source_offsets.to_vec());
    }

    // Pre-compile regex patterns so they are not re-compiled per row.
    let compiled: Vec<Option<Regex>> = filters
        .iter()
        .map(|f| -> Result<Option<Regex>, String> {
            if f.op == "regex" {
                Regex::new(&f.value)
                    .map(Some)
                    .map_err(|e| format!("invalid regex '{}': {e}", f.value))
            } else {
                Ok(None)
            }
        })
        .collect::<Result<_, _>>()?;

    let mut file = File::open(path).map_err(|e| format!("cannot open {path}: {e}"))?;
    let mut result = Vec::new();

    for (idx, &offset) in source_offsets.iter().enumerate() {
        let row_index = u32::try_from(idx).unwrap_or(u32::MAX);
        if let Ok(row) = parse_row_at(&mut file, offset, row_index) {
            let passes = filters
                .iter()
                .zip(compiled.iter())
                .all(|(f, re)| f.matches_with(&row, re.as_ref()));
            if passes {
                result.push(offset);
            }
        }
    }

    Ok(result)
}
