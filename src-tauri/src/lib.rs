use std::sync::{Arc, Mutex};
use tauri::{
    AppHandle, Manager, Runtime, Emitter,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
};
use tauri_plugin_autostart::MacosLauncher;

mod db;
mod tracker;
mod commands;

pub use db::Database;
pub use tracker::AppTracker;

pub struct AppState {
    pub db: Arc<Mutex<Database>>,
    pub tracker: Arc<Mutex<AppTracker>>,
    pub is_first_launch: bool,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    let db = Arc::new(Mutex::new(Database::new().expect("数据库初始化失败")));
    let tracker = Arc::new(Mutex::new(AppTracker::new()));
    let is_first_launch = {
        let db_guard = db.lock().unwrap();
        db_guard.is_first_launch().unwrap_or(true)
    };

    let state = AppState {
        db: db.clone(),
        tracker: tracker.clone(),
        is_first_launch,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 如果已有实例运行，显示窗口
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::get_app_usage_7days,
            commands::get_app_usage_30days,
            commands::get_today_usage,
            commands::get_settings,
            commands::save_settings,
            commands::set_autostart,
            commands::get_autostart,
            commands::mark_first_launch_done,
            commands::get_is_first_launch,
            commands::get_daily_usage,
            commands::get_refresh_interval,
            commands::set_refresh_interval,
            commands::get_hourly_usage_today,
            commands::open_data_dir,
            commands::clear_all_data,
        ])
        .setup(move |app| {
            setup_tray(app.handle())?;

            // 启动追踪器后台线程
            let db_clone = db.clone();
            let tracker_clone = tracker.clone();
            std::thread::spawn(move || {
                tracker::run_tracker(db_clone, tracker_clone);
            });

            // 首次启动：延迟显示窗口（等待 welcome 界面）
            // 非首次启动：不显示窗口（纯后台）
            let app_handle = app.handle().clone();
            let is_first = {
                let state = app_handle.state::<AppState>();
                state.is_first_launch
            };

            if is_first {
                let app_handle2 = app_handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(800));
                    if let Some(window) = app_handle2.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                });
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("运行应用失败");
}

fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "显示", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "关闭", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let _tray = TrayIconBuilder::with_id("main")
        .tooltip("应用时长追踪器")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("navigate", "home");
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
