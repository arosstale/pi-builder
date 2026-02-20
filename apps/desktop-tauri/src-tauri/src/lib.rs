pub mod commands;
pub mod pty;
pub mod worktree;

use commands::{
    AppState,
    get_repo_path, set_repo_path,
    pty_spawn, pty_input, pty_resize, pty_kill, pty_list,
    worktree_create, worktree_list, worktree_remove,
};
use pty::PtyManager;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            pty: Mutex::new(PtyManager::default()),
            repo_path: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            pty_spawn,
            pty_input,
            pty_resize,
            pty_kill,
            pty_list,
            worktree_create,
            worktree_list,
            worktree_remove,
            set_repo_path,
            get_repo_path,
        ])
        .run(tauri::generate_context!())
        .expect("error running pi-builder desktop");
}
