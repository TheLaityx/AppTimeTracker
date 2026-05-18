use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use chrono::Local;
use chrono::Timelike;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId, DestroyIcon};
use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
use windows::Win32::System::ProcessStatus::GetModuleFileNameExW;
use windows::Win32::Foundation::CloseHandle;
use windows::Win32::Graphics::Gdi::{GetDIBits, CreateCompatibleDC, SelectObject, DeleteDC, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, DeleteObject, GetObjectW, BITMAP};

use crate::db::Database;
use base64::Engine;

// 系统进程黑名单（不记录这些）
const SYSTEM_PROCESS_BLACKLIST: &[&str] = &[
    "explorer.exe",
    "searchhost.exe",
    "shellexperiencehost.exe",
    "startmenuexperiencehost.exe",
    "lockapp.exe",
    "logonui.exe",
    "dwm.exe",
    "winlogon.exe",
    "wininit.exe",
    "services.exe",
    "lsass.exe",
    "csrss.exe",
    "smss.exe",
    "svchost.exe",
    "taskhostw.exe",
    "sihost.exe",
    "ctfmon.exe",
    "fontdrvhost.exe",
    "runtimebroker.exe",
    "applicationframehost.exe",
    "systemsettings.exe",
    "textinputhost.exe",
    "searchindexer.exe",
    "spoolsv.exe",
    "winstore.app.exe",
    "backgroundtaskhost.exe",
    "dllhost.exe",
    "conhost.exe",
    "cmd.exe",
    "powershell.exe",
    "windowsterminal.exe",
    "app-time-tracker.exe",
];

#[derive(Debug, Clone)]
pub struct ActiveWindow {
    pub exe_name: String,
    pub app_name: String,
    pub exe_path: String,
}

pub struct AppTracker {
    pub current_window: Option<ActiveWindow>,
    pub session_map: HashMap<String, i64>, // exe_name -> seconds today
}

impl AppTracker {
    pub fn new() -> Self {
        AppTracker {
            current_window: None,
            session_map: HashMap::new(),
        }
    }
}

pub fn run_tracker(db: Arc<Mutex<Database>>, tracker: Arc<Mutex<AppTracker>>) {
    let poll_interval = Duration::from_secs(2);
    let save_interval = Duration::from_secs(30);
    let mut last_save = Instant::now();
    let mut pending: HashMap<String, (String, i64, Option<String>)> = HashMap::new(); // exe -> (app_name, seconds, icon_base64)
    let mut icon_cache: HashMap<String, Option<String>> = HashMap::new(); // exe_path -> icon_base64

    loop {
        std::thread::sleep(poll_interval);

        if let Some(window) = get_foreground_window_info() {
            let exe_lower = window.exe_name.to_lowercase();

            // 过滤系统进程
            if SYSTEM_PROCESS_BLACKLIST.iter().any(|b| exe_lower == *b) {
                continue;
            }

            // 提取图标（仅首次遇到该exe_path时提取）
            let icon = if let Some(cached) = icon_cache.get(&window.exe_path) {
                cached.clone()
            } else {
                let ico = extract_icon_base64(&window.exe_path);
                icon_cache.entry(window.exe_path.clone()).or_insert(ico).clone()
            };

            let entry = pending.entry(window.exe_name.clone()).or_insert((window.app_name.clone(), 0, icon.clone()));
            entry.0 = window.app_name.clone(); // 更新名称
            entry.1 += poll_interval.as_secs() as i64;
            if entry.2.is_none() && icon.is_some() {
                entry.2 = icon; // 补充图标
            }

            // 更新 tracker 当前窗口
            {
                let mut t = tracker.lock().unwrap();
                t.current_window = Some(window);
            }
        }

        // 定期写入数据库
        if last_save.elapsed() >= save_interval {
            let now = Local::now();
            let today = now.format("%Y-%m-%d").to_string();
            let current_hour = now.hour() as i32;
            {
                let db_guard = db.lock().unwrap();
                for (exe_name, (app_name, seconds, icon)) in &pending {
                    if *seconds > 0 {
                        let _ = db_guard.upsert_usage(exe_name, app_name, *seconds, &today, icon.as_deref());
                        let _ = db_guard.upsert_hourly_usage(exe_name, app_name, *seconds, &today, current_hour, icon.as_deref());
                    }
                }
                // 每天清理 35 天前的数据
                let _ = db_guard.cleanup_old_records(35);
            }
            // 重置 pending
            for v in pending.values_mut() {
                v.1 = 0;
            }
            last_save = Instant::now();
        }
    }
}

fn get_foreground_window_info() -> Option<ActiveWindow> {
    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.0 == 0 as _ {
            return None;
        }

        // 获取窗口标题
        let mut title_buf = [0u16; 512];
        let title_len = GetWindowTextW(hwnd, &mut title_buf);
        let title = if title_len > 0 {
            String::from_utf16_lossy(&title_buf[..title_len as usize])
        } else {
            String::new()
        };

        // 获取进程 ID
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return None;
        }

        // 打开进程获取 exe 路径
        let handle = OpenProcess(
            PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
            false,
            pid,
        ).ok()?;

        let mut path_buf = [0u16; 1024];
        let path_len = GetModuleFileNameExW(handle, None, &mut path_buf);
        let _ = CloseHandle(handle);

        if path_len == 0 {
            return None;
        }

        let exe_path = String::from_utf16_lossy(&path_buf[..path_len as usize]);
        let exe_name = std::path::Path::new(&exe_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown.exe")
            .to_string();

        // 用窗口标题作为应用名，如果没有标题就用 exe 名
        let app_name = if !title.is_empty() && title.len() < 80 {
            // 尝试从标题提取应用名（取 " - " 后最后一部分，或取全部）
            extract_app_name(&title, &exe_name)
        } else {
            exe_name_to_app_name(&exe_name)
        };

        Some(ActiveWindow {
            exe_name,
            app_name,
            exe_path,
        })
    }
}

fn extract_app_name(title: &str, exe_name: &str) -> String {
    // 常见应用名映射
    let exe_lower = exe_name.to_lowercase();
    let known: &[(&str, &str)] = &[
        ("chrome.exe", "Google Chrome"),
        ("msedge.exe", "Microsoft Edge"),
        ("firefox.exe", "Firefox"),
        ("code.exe", "VS Code"),
        ("devenv.exe", "Visual Studio"),
        ("notepad.exe", "记事本"),
        ("notepad++.exe", "Notepad++"),
        ("winword.exe", "Word"),
        ("excel.exe", "Excel"),
        ("powerpnt.exe", "PowerPoint"),
        ("outlook.exe", "Outlook"),
        ("teams.exe", "Microsoft Teams"),
        ("slack.exe", "Slack"),
        ("discord.exe", "Discord"),
        ("wechat.exe", "微信"),
        ("qq.exe", "QQ"),
        ("qqmusic.exe", "QQ音乐"),
        ("neteasemusic.exe", "网易云音乐"),
        ("spotify.exe", "Spotify"),
        ("vlc.exe", "VLC"),
        ("potplayer.exe", "PotPlayer"),
        ("photoshop.exe", "Photoshop"),
        ("figma.exe", "Figma"),
        ("obs64.exe", "OBS Studio"),
        ("steam.exe", "Steam"),
        ("idea64.exe", "IntelliJ IDEA"),
        ("pycharm64.exe", "PyCharm"),
        ("cursor.exe", "Cursor"),
        ("postman.exe", "Postman"),
        ("dbeaver.exe", "DBeaver"),
        ("telegram.exe", "Telegram"),
    ];

    for (exe, name) in known {
        if exe_lower == *exe {
            return name.to_string();
        }
    }

    // 从标题中提取应用名
    if title.contains(" - ") {
        let parts: Vec<&str> = title.splitn(2, " - ").collect();
        if parts.len() > 1 {
            let last = parts.last().unwrap().trim();
            if !last.is_empty() && last.len() < 40 {
                return last.to_string();
            }
        }
    }

    exe_name_to_app_name(exe_name)
}

fn exe_name_to_app_name(exe_name: &str) -> String {
    let name = exe_name
        .trim_end_matches(".exe")
        .trim_end_matches(".EXE");
    // 首字母大写
    let mut chars = name.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

/// 从 exe 路径提取图标并转为 PNG base64
pub fn extract_icon_base64(exe_path: &str) -> Option<String> {
    let engine = base64::engine::general_purpose::STANDARD;

    unsafe {
        let wide_path: Vec<u16> = exe_path.encode_utf16().chain(std::iter::once(0)).collect();
        // 使用 Shell API ExtractIconW
        let hicon = windows::Win32::UI::Shell::ExtractIconW(
            None,
            windows::core::PCWSTR(wide_path.as_ptr()),
            0,
        );
        if hicon.is_invalid() {
            return None;
        }

        let result = icon_to_png_base64(hicon, &engine);
        let _ = DestroyIcon(hicon);
        result
    }
}

/// 根据 exe 名称尝试从常见路径提取图标（保留但暂不使用）
unsafe fn icon_to_png_base64<E: base64::Engine>(hicon: windows::Win32::UI::WindowsAndMessaging::HICON, engine: &E) -> Option<String> {
    // 获取图标位图
    let mut icon_info: windows::Win32::UI::WindowsAndMessaging::ICONINFO = std::mem::zeroed();
    if windows::Win32::UI::WindowsAndMessaging::GetIconInfo(hicon, &mut icon_info).is_err() {
        return None;
    }

    // 获取颜色位图信息
    let mut bm = BITMAP::default();
    GetObjectW(
        icon_info.hbmColor,
        std::mem::size_of::<BITMAP>() as i32,
        Some(&mut bm as *mut BITMAP as *mut _),
    );

    let width = bm.bmWidth.abs() as u32;
    let height = bm.bmHeight.abs() as u32;
    if width == 0 || height == 0 || width > 256 || height > 256 {
        let _ = DeleteObject(icon_info.hbmColor);
        let _ = DeleteObject(icon_info.hbmMask);
        return None;
    }

    // 创建兼容DC并获取像素数据
    let hdc = CreateCompatibleDC(None);
    let old_bmp = SelectObject(hdc, icon_info.hbmColor);

    let mut bmi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width as i32,
            biHeight: -(height as i32), // top-down
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };

    let buf_size = (width * height * 4) as usize;
    let mut pixels = vec![0u8; buf_size];
    let rows = GetDIBits(
        hdc,
        icon_info.hbmColor,
        0,
        height,
        Some(pixels.as_mut_ptr() as *mut _),
        &mut bmi,
        DIB_RGB_COLORS,
    );

    let _ = SelectObject(hdc, old_bmp);
    let _ = DeleteDC(hdc);
    let _ = DeleteObject(icon_info.hbmColor);
    let _ = DeleteObject(icon_info.hbmMask);

    if rows == 0 {
        return None;
    }

    // BGRA -> RGBA
    for chunk in pixels.chunks_exact_mut(4) {
        chunk.swap(0, 2); // B<->R
    }

    // 编码为 PNG
    let img = image::RgbaImage::from_raw(width, height, pixels)?;
    let mut png_buf = Vec::new();
    img.write_to(&mut std::io::Cursor::new(&mut png_buf), image::ImageFormat::Png).ok()?;

    Some(engine.encode(&png_buf))
}
