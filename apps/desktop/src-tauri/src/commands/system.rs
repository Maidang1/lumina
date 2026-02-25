use tauri_plugin_notification::NotificationExt;

#[tauri::command]
pub async fn show_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| format!("Failed to show notification: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn open_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    open_in_file_manager(&path, |p| ("open", vec!["-R", p]))?;

    #[cfg(target_os = "windows")]
    open_in_file_manager(&path, |p| ("explorer", vec!["/select,", p]))?;

    #[cfg(target_os = "linux")]
    {
        let parent = std::path::Path::new(&path)
            .parent()
            .and_then(|p| p.to_str())
            .unwrap_or("/");
        open_in_file_manager(parent, |p| ("xdg-open", vec![p]))?;
    }

    Ok(())
}

#[inline]
fn open_in_file_manager(
    path: &str,
    cmd_builder: impl Fn(&str) -> (&str, Vec<&str>),
) -> Result<(), String> {
    let (cmd, args) = cmd_builder(path);
    std::process::Command::new(cmd)
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to open in file manager: {}", e))?;
    Ok(())
}
