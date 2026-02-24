mod commands;
mod github;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_file_as_bytes,
            commands::fs::get_file_info,
            commands::fs::scan_directory,
            commands::system::show_notification,
            commands::system::open_in_finder,
            commands::github::github_upload_image,
            commands::github::github_delete_image,
            commands::github::github_finalize_batch,
            commands::github::github_list_images,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
