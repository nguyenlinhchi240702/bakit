use serde::Serialize;
use std::path::PathBuf;
use tauri::Manager;
use xcap::{image, Monitor};

/// One captured monitor, saved as a PNG in the app cache folder.
#[derive(Serialize)]
struct Shot {
    index: usize,
    name: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    scale: f32,
    primary: bool,
    path: String,
    /// true on macOS: x/y are points (logical), so the overlay is placed with logical units.
    logical: bool,
    lw: f64,
    lh: f64,
}

fn capture_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("capture");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Grab every monitor at full resolution (BAKit hides itself before calling this).
#[tauri::command]
async fn capture_monitors(app: tauri::AppHandle) -> Result<Vec<Shot>, String> {
    let dir = capture_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let monitors = Monitor::all().map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for (i, m) in monitors.iter().enumerate() {
            let img = m.capture_image().map_err(|e| e.to_string())?;
            let path = dir.join(format!("shot_{stamp}_{i}.png"));
            img.save(&path).map_err(|e| e.to_string())?;
            out.push(Shot {
                index: i,
                name: m.name().unwrap_or_else(|_| format!("Màn hình {}", i + 1)),
                x: m.x().unwrap_or(0),
                y: m.y().unwrap_or(0),
                width: img.width(),
                height: img.height(),
                scale: m.scale_factor().unwrap_or(1.0),
                primary: m.is_primary().unwrap_or(i == 0),
                path: path.to_string_lossy().into_owned(),
                logical: cfg!(target_os = "macos"),
                lw: m.width().map(f64::from).unwrap_or(img.width() as f64),
                lh: m.height().map(f64::from).unwrap_or(img.height() as f64),
            });
        }
        if out.is_empty() {
            return Err("Không tìm thấy màn hình nào".to_string());
        }
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Crop a region (image pixels) out of a captured monitor and return it as PNG bytes.
#[tauri::command]
async fn read_capture(
    app: tauri::AppHandle,
    path: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<tauri::ipc::Response, String> {
    let dir = capture_dir(&app)?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let file = PathBuf::from(&path)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if !file.starts_with(&dir) {
        return Err("Đường dẫn ảnh chụp không hợp lệ".to_string());
    }
    let bytes = tauri::async_runtime::spawn_blocking(move || -> Result<Vec<u8>, String> {
        let img = image::open(&file).map_err(|e| e.to_string())?.to_rgba8();
        let (iw, ih) = img.dimensions();
        let x = x.min(iw.saturating_sub(1));
        let y = y.min(ih.saturating_sub(1));
        let w = width.max(1).min(iw - x);
        let h = height.max(1).min(ih - y);
        let sub = image::imageops::crop_imm(&img, x, y, w, h).to_image();
        let mut buf = std::io::Cursor::new(Vec::new());
        sub.write_to(&mut buf, image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;
        Ok(buf.into_inner())
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(bytes))
}

/// Remove temporary full-monitor captures once the region has been saved.
#[tauri::command]
fn clear_captures(app: tauri::AppHandle) -> Result<(), String> {
    let dir = capture_dir(&app)?;
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for e in entries.flatten() {
            let _ = std::fs::remove_file(e.path());
        }
    }
    Ok(())
}

// ---------- macOS: screen-recording permission ----------
#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

/// true when BAKit may record the screen. On macOS, `request` shows the system prompt the first time.
#[tauri::command]
fn screen_access(request: bool) -> bool {
    #[cfg(target_os = "macos")]
    {
        let ok = unsafe { CGPreflightScreenCaptureAccess() };
        if !ok && request {
            unsafe { CGRequestScreenCaptureAccess() };
        }
        ok
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = request;
        true
    }
}

/// Opens System Settings → Privacy & Security → Screen Recording (macOS).
#[tauri::command]
fn open_screen_settings() {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
            .spawn();
    }
}

/// macOS: let a capture overlay window float above full-screen apps and the menu bar,
/// on whichever Space is currently shown. No-op elsewhere.
#[tauri::command]
fn overlay_native(app: tauri::AppHandle, label: String) {
    #[cfg(target_os = "macos")]
    {
        if let Some(win) = app.get_webview_window(&label) {
            if let Ok(ptr) = win.ns_window() {
                let ns = ptr as *mut objc2::runtime::AnyObject;
                // canJoinAllSpaces | stationary | ignoresCycle | fullScreenAuxiliary
                let behavior: usize = (1 << 0) | (1 << 4) | (1 << 6) | (1 << 8);
                unsafe {
                    let _: () = objc2::msg_send![ns, setCollectionBehavior: behavior];
                    let _: () = objc2::msg_send![ns, setLevel: 1000isize]; // screen-saver level, above the menu bar
                }
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, label);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            capture_monitors,
            read_capture,
            clear_captures,
            screen_access,
            open_screen_settings,
            overlay_native
        ])
        .run(tauri::generate_context!())
        .expect("BAKit gặp lỗi khi khởi động");
}
