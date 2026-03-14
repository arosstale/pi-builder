//! Git worktree management via git2.
//!
//! Each agent session gets its own worktree on a fresh branch so agents
//! can work in parallel without stepping on each other. The main thread
//! stays on the base branch; we track divergence for the UI.

use anyhow::{Context, Result};
use git2::{BranchType, Repository, WorktreeAddOptions};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct WorktreeInfo {
    pub name: String,
    pub path: String,
    pub branch: String,
    pub ahead: usize,
    pub behind: usize,
    pub dirty: bool,
}

/// Create a new worktree for an agent session.
/// Branch name: `agent/<session_id>`.
/// Worktree path: `<repo_root>/.git/worktrees-pi/<session_id>`.
pub fn create_worktree(repo_path: &str, session_id: &str) -> Result<WorktreeInfo> {
    let repo = Repository::open(repo_path).context("open repo")?;
    let branch_name = format!("agent/{}", &session_id[..8]);

    // Create branch from HEAD
    let head = repo.head()?.peel_to_commit()?;
    repo.branch(&branch_name, &head, false)
        .or_else(|_| repo.find_branch(&branch_name, BranchType::Local))?;

    // Worktree path inside .git so it's gitignored automatically
    let wt_path: PathBuf = [repo_path, ".git", "worktrees-pi", session_id]
        .iter()
        .collect();
    std::fs::create_dir_all(&wt_path)?;

    let mut opts = WorktreeAddOptions::new();
    let branch = repo.find_branch(&branch_name, BranchType::Local)?;
    let branch_ref = branch.get().name().context("branch ref name")?;
    // Note: git2 WorktreeAddOptions::reference takes an &Reference
    // We re-find it to get the owned reference
    let reference = repo.find_reference(branch_ref)?;
    opts.reference(Some(&reference));

    repo.worktree(session_id, &wt_path, Some(&opts))
        .context("create worktree")?;

    Ok(WorktreeInfo {
        name: session_id.to_string(),
        path: wt_path.to_string_lossy().to_string(),
        branch: branch_name,
        ahead: 0,
        behind: 0,
        dirty: false,
    })
}

/// Get divergence stats for all worktrees (ahead/behind main, dirty status).
pub fn list_worktrees(repo_path: &str) -> Result<Vec<WorktreeInfo>> {
    let repo = Repository::open(repo_path).context("open repo")?;
    let mut result = Vec::new();

    for wt_name in repo.worktrees()?.iter().flatten() {
        let wt = match repo.find_worktree(wt_name) {
            Ok(w) => w,
            Err(_) => continue,
        };

        let wt_path = wt.path().to_string_lossy().to_string();
        let wt_repo = match Repository::open(wt.path()) {
            Ok(r) => r,
            Err(_) => continue,
        };

        let branch = wt_repo
            .head()
            .ok()
            .and_then(|h| h.shorthand().map(str::to_string))
            .unwrap_or_else(|| "detached".into());

        let (ahead, behind) = divergence(&wt_repo, &repo).unwrap_or((0, 0));
        let dirty = is_dirty(&wt_repo);

        result.push(WorktreeInfo {
            name: wt_name.to_string(),
            path: wt_path,
            branch,
            ahead,
            behind,
            dirty,
        });
    }

    Ok(result)
}

/// Remove a worktree and delete its branch.
pub fn remove_worktree(repo_path: &str, name: &str) -> Result<()> {
    let repo = Repository::open(repo_path).context("open repo")?;
    let wt = repo.find_worktree(name).context("find worktree")?;
    wt.prune(None)?;

    let branch_name = format!("agent/{}", &name[..8.min(name.len())]);
    if let Ok(mut branch) = repo.find_branch(&branch_name, BranchType::Local) {
        let _ = branch.delete();
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn divergence(wt_repo: &Repository, main_repo: &Repository) -> Result<(usize, usize)> {
    let wt_head = wt_repo.head()?.peel_to_commit()?.id();
    let main_head = main_repo.head()?.peel_to_commit()?.id();

    let (ahead, behind) = wt_repo.graph_ahead_behind(wt_head, main_head)?;
    Ok((ahead, behind))
}

fn is_dirty(repo: &Repository) -> bool {
    repo.statuses(None)
        .map(|s| s.iter().any(|e| e.status() != git2::Status::CURRENT))
        .unwrap_or(false)
}
