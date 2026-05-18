use anyhow::Result;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use chrono::Local;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppUsageSummary {
    pub app_name: String,
    pub exe_name: String,
    pub total_seconds: i64,
    pub icon_base64: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyUsage {
    pub date: String,
    pub total_seconds: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HourlyUsage {
    pub hour: i32,       // 0-23
    pub total_seconds: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub autostart: bool,
    pub theme: String, // "system", "light", "dark"
    pub excluded_apps: Vec<String>,
    pub first_launch_done: bool,
    pub refresh_interval: u64, // 刷新间隔，单位秒
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            autostart: true,
            theme: "system".to_string(),
            excluded_apps: vec![],
            first_launch_done: false,
            refresh_interval: 60,
        }
    }
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new() -> Result<Self> {
        let data_dir = get_data_dir();
        std::fs::create_dir_all(&data_dir)?;
        let db_path = data_dir.join("usage.db");
        let conn = Connection::open(db_path)?;
        let db = Database { conn };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<()> {
        self.conn.execute_batch("
            PRAGMA journal_mode=WAL;
            PRAGMA synchronous=NORMAL;

            CREATE TABLE IF NOT EXISTS app_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                app_name TEXT NOT NULL,
                exe_name TEXT NOT NULL,
                duration_seconds INTEGER NOT NULL DEFAULT 0,
                date TEXT NOT NULL,
                icon_base64 TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(exe_name, date)
            );

            CREATE TABLE IF NOT EXISTS hourly_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                exe_name TEXT NOT NULL,
                app_name TEXT NOT NULL,
                date TEXT NOT NULL,
                hour INTEGER NOT NULL,
                duration_seconds INTEGER NOT NULL DEFAULT 0,
                icon_base64 TEXT,
                UNIQUE(exe_name, date, hour)
            );

            CREATE INDEX IF NOT EXISTS idx_hourly ON hourly_usage(date, hour);

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_date ON app_usage(date);
            CREATE INDEX IF NOT EXISTS idx_exe ON app_usage(exe_name);
        ")?;

        // 迁移：为旧表添加 icon_base64 列（用 PRAGMA table_info 检测）
        let cols: Vec<String> = self.conn
            .prepare("PRAGMA table_info(app_usage)")?
            .query_map([], |row| row.get::<_, String>(1))?
            .filter_map(|r| r.ok())
            .collect();
        if !cols.iter().any(|c| c == "icon_base64") {
            self.conn.execute("ALTER TABLE app_usage ADD COLUMN icon_base64 TEXT", [])?;
        }

        Ok(())
    }

    pub fn upsert_usage(&self, exe_name: &str, app_name: &str, seconds: i64, date: &str, icon_base64: Option<&str>) -> Result<()> {
        // 先检查是否已有图标（不覆盖已有图标）
        let existing_icon: Option<String> = self.conn.query_row(
            "SELECT icon_base64 FROM app_usage WHERE exe_name = ?1 AND date = ?2",
            params![exe_name, date],
            |row| row.get(0),
        ).ok().flatten();

        let icon = icon_base64.or(existing_icon.as_deref());

        self.conn.execute(
            "INSERT INTO app_usage (app_name, exe_name, duration_seconds, date, icon_base64)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(exe_name, date) DO UPDATE SET
                duration_seconds = duration_seconds + ?3,
                app_name = ?1,
                icon_base64 = COALESCE(icon_base64, ?5),
                updated_at = CURRENT_TIMESTAMP",
            params![app_name, exe_name, seconds, date, icon],
        )?;
        Ok(())
    }

    pub fn upsert_hourly_usage(&self, exe_name: &str, app_name: &str, seconds: i64, date: &str, hour: i32, icon_base64: Option<&str>) -> Result<()> {
        self.conn.execute(
            "INSERT INTO hourly_usage (exe_name, app_name, date, hour, duration_seconds, icon_base64)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(exe_name, date, hour) DO UPDATE SET
                duration_seconds = duration_seconds + ?5,
                app_name = ?2,
                icon_base64 = COALESCE(icon_base64, ?6)",
            params![exe_name, app_name, date, hour, seconds, icon_base64],
        )?;
        Ok(())
    }

    pub fn get_usage_range(&self, start_date: &str, end_date: &str) -> Result<Vec<AppUsageSummary>> {
        let mut stmt = self.conn.prepare(
            "SELECT exe_name, app_name, SUM(duration_seconds) as total, MAX(icon_base64) as icon
             FROM app_usage
             WHERE date >= ?1 AND date <= ?2
             GROUP BY exe_name
             ORDER BY total DESC
             LIMIT 50"
        )?;
        let rows = stmt.query_map(params![start_date, end_date], |row| {
            Ok(AppUsageSummary {
                exe_name: row.get(0)?,
                app_name: row.get(1)?,
                total_seconds: row.get(2)?,
                icon_base64: row.get(3)?,
            })
        })?;
        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }

    pub fn get_today_usage(&self) -> Result<Vec<AppUsageSummary>> {
        let today = Local::now().format("%Y-%m-%d").to_string();
        self.get_usage_range(&today, &today)
    }

    /// 按天统计近期每日使用时长
    pub fn get_daily_usage(&self, days: i64) -> Result<Vec<DailyUsage>> {
        let mut result = Vec::new();
        for i in (0..days).rev() {
            let date = (Local::now() - chrono::Duration::days(i))
                .format("%Y-%m-%d").to_string();
            let usage = self.get_usage_range(&date, &date)?;
            let total: i64 = usage.iter().map(|u| u.total_seconds).sum();
            result.push(DailyUsage {
                date: date.clone(),
                total_seconds: total,
            });
        }
        Ok(result)
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let result = stmt.query_row(params![key], |row| row.get(0));
        match result {
            Ok(val) => Ok(Some(val)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_settings(&self) -> Result<Settings> {
        let json = self.get_setting("settings")?;
        match json {
            Some(s) => Ok(serde_json::from_str(&s)?),
            None => Ok(Settings::default()),
        }
    }

    pub fn save_settings(&self, settings: &Settings) -> Result<()> {
        let json = serde_json::to_string(settings)?;
        self.set_setting("settings", &json)?;
        Ok(())
    }

    pub fn is_first_launch(&self) -> Result<bool> {
        let settings = self.get_settings()?;
        Ok(!settings.first_launch_done)
    }

    pub fn mark_first_launch_done(&self) -> Result<()> {
        let mut settings = self.get_settings()?;
        settings.first_launch_done = true;
        self.save_settings(&settings)?;
        Ok(())
    }

    /// 今日按2小时分段统计（基于真实hourly_usage数据）
    pub fn get_hourly_usage_today(&self) -> Result<Vec<HourlyUsage>> {
        let today = Local::now().format("%Y-%m-%d").to_string();

        let mut stmt = self.conn.prepare(
            "SELECT hour, SUM(duration_seconds) FROM hourly_usage WHERE date = ?1 GROUP BY hour"
        )?;
        let rows: std::collections::HashMap<i32, i64> = stmt
            .query_map(params![today], |row| {
                Ok((row.get::<_, i32>(0)?, row.get::<_, i64>(1)?))
            })?
            .filter_map(|r| r.ok())
            .collect();

        // 按2小时分桶: 0-1, 2-3, 4-5, ..., 22-23
        let mut result = Vec::new();
        for bucket_start in (0..24).step_by(2) {
            let seconds = rows.get(&bucket_start).copied().unwrap_or(0)
                + rows.get(&(bucket_start + 1)).copied().unwrap_or(0);
            result.push(HourlyUsage {
                hour: bucket_start,
                total_seconds: seconds,
            });
        }
        Ok(result)
    }

    pub fn clear_all_data(&self) -> Result<()> {
        self.conn.execute("DELETE FROM app_usage", [])?;
        self.conn.execute("DELETE FROM hourly_usage", [])?;
        Ok(())
    }

    pub fn cleanup_old_records(&self, days: i64) -> Result<()> {
        let cutoff = (Local::now() - chrono::Duration::days(days))
            .format("%Y-%m-%d").to_string();
        self.conn.execute(
            "DELETE FROM app_usage WHERE date < ?1",
            params![cutoff],
        )?;
        Ok(())
    }
}

pub fn get_data_dir() -> PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata).join("AppTimeTracker")
    } else {
        PathBuf::from(".")
    }
}
