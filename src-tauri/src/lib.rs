mod commands;

use std::{collections::HashMap, sync::Mutex};

use tauri_specta::{collect_commands, Builder};

#[must_use]
pub fn create_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::greet,
        commands::open_dlt_file,
        commands::get_log_rows,
    ])
}

/// # Panics
/// Panics if TypeScript bindings cannot be written to disk.
pub fn export_bindings() {
    create_builder()
        .export(
            specta_typescript::Typescript::default(),
            concat!(env!("CARGO_MANIFEST_DIR"), "/../src/bindings.ts"),
        )
        .expect("Failed to export TypeScript bindings");
}

/// # Panics
/// Panics if the Tauri application fails to start.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(debug_assertions)]
    export_bindings();

    let builder = create_builder();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::AppState {
            dlt_files: Mutex::new(HashMap::new()),
        })
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
