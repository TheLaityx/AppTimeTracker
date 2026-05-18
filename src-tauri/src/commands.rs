use tauri::State;
use tauri_plugin_autostart::ManagerExt;
use serde::{Deserialize, Serialize};
use chrono::Local;

use crate::{AppState, db::{Settings, DailyUsage, HourlyUsage}};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppUsageResult {
    pub app_name: String,
    pub exe_name: String,
    pub total_seconds: i64,
    pub icon_base64: Option<String>,
}

#[tauri::command]
pub fn get_app_usage_7days(state: State<AppState>) -> Result<Vec<AppUsageResult>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let end = Local::now().format("%Y-%m-%d").to_string();
    let start = (Local::now() - chrono::Duration::days(6))
        .format("%Y-%m-%d").to_string();
    let records = db.get_usage_range(&start, &end).map_err(|e| e.to_string())?;
    Ok(records.into_iter().map(|r| AppUsageResult {
        app_name: r.app_name,
        exe_name: r.exe_name,
        total_seconds: r.total_seconds,
        icon_base64: r.icon_base64,
    }).collect())
}

#[tauri::command]
pub fn get_app_usage_30days(state: State<AppState>) -> Result<Vec<AppUsageResult>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let end = Local::now().format("%Y-%m-%d").to_string();
    let start = (Local::now() - chrono::Duration::days(29))
        .format("%Y-%m-%d").to_string();
    let records = db.get_usage_range(&start, &end).map_err(|e| e.to_string())?;
    Ok(records.into_iter().map(|r| AppUsageResult {
        app_name: r.app_name,
        exe_name: r.exe_name,
        total_seconds: r.total_seconds,
        icon_base64: r.icon_base64,
    }).collect())
}

#[tauri::command]
pub fn get_today_usage(state: State<AppState>) -> Result<Vec<AppUsageResult>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let records = db.get_today_usage().map_err(|e| e.to_string())?;
    Ok(records.into_iter().map(|r| AppUsageResult {
        app_name: r.app_name,
        exe_name: r.exe_name,
        total_seconds: r.total_seconds,
        icon_base64: r.icon_base64,
    }).collect())
}

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<Settings, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings(state: State<AppState>, settings: Settings) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_settings(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_autostart(
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<(), String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|e| e.to_string())
    } else {
        manager.disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn get_autostart(app: tauri::AppHandle) -> Result<bool, String> {
    let manager = app.autolaunch();
    manager.is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mark_first_launch_done(state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.mark_first_launch_done().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_is_first_launch(state: State<AppState>) -> bool {
    state.is_first_launch
}

#[tauri::command]
pub fn get_daily_usage(state: State<AppState>, days: i64) -> Result<Vec<DailyUsage>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_daily_usage(days).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_refresh_interval(state: State<AppState>) -> Result<u64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let settings = db.get_settings().map_err(|e| e.to_string())?;
    Ok(settings.refresh_interval)
}

#[tauri::command]
pub fn set_refresh_interval(state: State<AppState>, interval: u64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut settings = db.get_settings().map_err(|e| e.to_string())?;
    settings.refresh_interval = interval.max(5).min(600); // 5秒~10分钟
    db.save_settings(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_hourly_usage_today(state: State<AppState>) -> Result<Vec<HourlyUsage>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_hourly_usage_today().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_data_dir() -> Result<(), String> {
    let dir = crate::db::get_data_dir();
    open::that(dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_all_data(state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.clear_all_data().map_err(|e| e.to_string())
}
