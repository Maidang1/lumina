mod commands;
mod github;

use tauri::Manager;

fn configure_rayon_global_pool() {
    let logical_cpus = std::thread::available_parallelism()
        .map(|value| value.get())
        .unwrap_or(4);
    let target_threads = std::cmp::max(2, logical_cpus / 2);
    let _ = rayon::ThreadPoolBuilder::new()
        .num_threads(target_threads)
        .build_global();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    configure_rayon_global_pool();

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
            commands::fs::scan_folder_images,
            commands::system::show_notification,
            commands::system::open_in_finder,
            commands::github::github_upload_image,
            commands::github::github_delete_image,
            commands::github::github_revert_image,
            commands::github::github_finalize_batch,
            commands::github::github_list_images,
            commands::github::github_update_image_metadata,
            commands::github::github_get_repo_status,
            commands::github::github_get_changes_preview,
            commands::github::github_stage_file,
            commands::github::github_unstage_file,
            commands::github::github_discard_file,
            commands::github::github_delete_file,
            commands::github::github_stage_all,
            commands::github::github_unstage_all,
            commands::github::github_commit_and_push,
            commands::github::github_sync_repo,
            commands::clone::parse_github_url,
            commands::clone::get_default_clone_directory,
            commands::clone::github_clone_repo,
            commands::image::parse_image_for_upload_from_path,
            commands::image::parse_image_for_upload_from_path_optimized,
            commands::image::upload_from_cache_to_github,
            commands::image::generate_preview_for_unsupported,
            commands::metadata::merge_and_validate_metadata,
            commands::metadata::batch_merge_and_validate_metadata,
            commands::events::start_batch_upload_with_events,
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
