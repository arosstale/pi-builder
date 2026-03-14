//! PTY session management via portable-pty.
//!
//! Each PtySession wraps a portable-pty child process. stdout is forwarded
//! to the Tauri event system as high-frequency "pty://data/<id>" events.
//! stdin is written via Tauri commands. No WebSocket layer — Tauri IPC handles
//! the frontend ↔ backend channel.

use anyhow::{Context, Result};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{Arc, Mutex},
    thread,
};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

pub struct PtySession {
    pub id: String,
    pub agent_id: String,
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    pub cols: u16,
    pub rows: u16,
    pub alive: Arc<Mutex<bool>>,
}

impl PtySession {
    pub fn write(&self, data: &str) -> Result<()> {
        let master = self.master.lock().unwrap();
        let mut writer = master.take_writer()?;
        writer.write_all(data.as_bytes())?;
        Ok(())
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<()> {
        let master = self.master.lock().unwrap();
        master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })?;
        Ok(())
    }

    pub fn kill(&self) {
        *self.alive.lock().unwrap() = false;
    }
}

// ---------------------------------------------------------------------------
// PtyManager
// ---------------------------------------------------------------------------

#[derive(Default)]
pub struct PtyManager {
    sessions: HashMap<String, Arc<PtySession>>,
}

impl PtyManager {
    pub fn spawn(
        &mut self,
        agent_id: String,
        cmd: Vec<String>,
        cwd: Option<String>,
        cols: u16,
        rows: u16,
        app: AppHandle,
    ) -> Result<String> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .context("openpty")?;

        // Build command
        let mut builder = if cmd.is_empty() {
            default_shell()
        } else {
            let mut b = CommandBuilder::new(&cmd[0]);
            for arg in cmd.iter().skip(1) {
                b.arg(arg);
            }
            b
        };

        if let Some(dir) = cwd {
            builder.cwd(dir);
        }

        // Spawn into the slave PTY
        let _child: Box<dyn Child + Send + Sync> = pair.slave.spawn_command(builder)?;

        let id = Uuid::new_v4().to_string();
        let alive = Arc::new(Mutex::new(true));
        let master = Arc::new(Mutex::new(pair.master));

        let session = Arc::new(PtySession {
            id: id.clone(),
            agent_id: agent_id.clone(),
            master: master.clone(),
            cols,
            rows,
            alive: alive.clone(),
        });

        // Reader thread — streams PTY stdout to Tauri events
        let session_id = id.clone();
        let agent_id_clone = agent_id.clone();
        let app_clone = app.clone();
        let alive_clone = alive.clone();
        thread::spawn(move || {
            let mut reader = {
                let m = master.lock().unwrap();
                m.try_clone_reader().expect("clone reader")
            };
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_clone.emit(
                            &format!("pty://data/{}", session_id),
                            serde_json::json!({
                                "sessionId": session_id,
                                "agentId": agent_id_clone,
                                "data": chunk,
                            }),
                        );
                    }
                }
            }
            *alive_clone.lock().unwrap() = false;
            let _ = app_clone.emit(
                &format!("pty://exit/{}", session_id),
                serde_json::json!({ "sessionId": session_id, "exitCode": 0 }),
            );
        });

        self.sessions.insert(id.clone(), session);
        Ok(id)
    }

    pub fn write(&self, session_id: &str, data: &str) -> Result<()> {
        self.get(session_id)?.write(data)
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<()> {
        self.get(session_id)?.resize(cols, rows)
    }

    pub fn kill(&self, session_id: &str) {
        if let Some(s) = self.sessions.get(session_id) {
            s.kill();
        }
    }

    pub fn list(&self) -> Vec<serde_json::Value> {
        self.sessions
            .values()
            .map(|s| {
                serde_json::json!({
                    "sessionId": s.id,
                    "agentId": s.agent_id,
                    "alive": *s.alive.lock().unwrap(),
                    "cols": s.cols,
                    "rows": s.rows,
                })
            })
            .collect()
    }

    fn get(&self, id: &str) -> Result<&Arc<PtySession>> {
        self.sessions.get(id).context("session not found")
    }
}

fn default_shell() -> CommandBuilder {
    if cfg!(windows) {
        CommandBuilder::new("cmd.exe")
    } else {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into());
        CommandBuilder::new(shell)
    }
}
