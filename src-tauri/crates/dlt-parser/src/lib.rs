//! DLT (Diagnostic Log and Trace) file parser.
//!
//! Parses the DLT Storage Format defined by AUTOSAR/COVESA.
//! Two-phase access: index the file once with [`index_file`], then fetch rows
//! on demand with [`parse_row_at`].

#![allow(clippy::module_name_repetitions)]

mod filter;
mod index;
mod parser;
mod types;

pub use filter::{apply_filters, DltFilter};
pub use index::index_file;
pub use parser::parse_row_at;
pub use types::{DltFileInfo, DltFileState, DltRow};
