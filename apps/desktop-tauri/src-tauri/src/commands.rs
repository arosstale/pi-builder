//! Tauri command bridge — frontend calls these via invoke().

use crate::{pty::PtyManager, worktree};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, State};

pub struct AppState {
    pub pty: Mutex<PtyManager>,
    pub repo_path: Mutex<Option<String>>,
}

// ---------------------------------------------------------------------------
// PTY commands
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct SpawnArgs {
    pub agent_id: String,
    pub cmd: Vec<String>,
    pub cwd: Option<String>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
}

#[derive(Serialize)]
pub struct SpawnResult {
    pub session_id: String,
}

#[tauri::command]
pub async fn pty_spawn(
    args: SpawnArgs,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<SpawnResult, String> {
    let mut mgr = state.pty.lock().unwrap();
    let cwd = args.cwd.or_else(|| {
        state.repo_path.lock().unwrap().clone()
    });
    mgr.spawn(
        args.agent_id,
        args.cmd,
        cwd,
        args.cols.unwrap_or(220),
        args.rows.unwrap_or(50),
        app,
    )
    .map(|session_id| SpawnResult { session_id })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_input(
    session_id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.pty.lock().unwrap().write(&session_id, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_resize(
    session_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.pty.lock().unwrap().resize(&session_id, cols, rows).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_kill(session_id: String, state: State<'_, AppState>) {
    state.pty.lock().unwrap().kill(&session_id);
}

#[tauri::command]
pub fn pty_list(state: State<'_, AppState>) -> Vec<serde_json::Value> {
    state.pty.lock().unwrap().list()
}

// ---------------------------------------------------------------------------
// Worktree commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn worktree_create(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<worktree::WorktreeInfo, String> {
    let repo = state
        .repo_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("no repo configured")?;
    worktree::create_worktree(&repo, &session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn worktree_list(state: State<'_, AppState>) -> Result<Vec<worktree::WorktreeInfo>, String> {
    let repo = state
        .repo_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("no repo configured")?;
    worktree::list_worktrees(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn worktree_remove(
    name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let repo = state
        .repo_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("no repo configured")?;
    worktree::remove_worktree(&repo, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_repo_path(path: String, state: State<'_, AppState>) {
    *state.repo_path.lock().unwrap() = Some(path);
}

#[tauri::command]
pub fn get_repo_path(state: State<'_, AppState>) -> Option<String> {
    state.repo_path.lock().unwrap().clone()
}
