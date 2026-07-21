#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::Write;
use std::process::{Command, Stdio};

/// Absolute path to the bridge script, resolved relative to Cargo.toml at compile time.
const BRIDGE_SCRIPT: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/core-bridge.ts");

/// Spawn `bun run core-bridge.ts <command>` with JSON args piped to stdin.
/// Returns the JSON response line.
fn call_bridge(command: &str, args_json: &str) -> Result<String, String> {
    let request = if args_json.is_empty() || args_json == "{}" {
        format!("{{\"command\":\"{}\"}}\n", command)
    } else {
        format!("{{\"command\":\"{}\",\"args\":{}}}\n", command, args_json)
    };

    let mut child = Command::new("bun")
        .arg("run")
        .arg(BRIDGE_SCRIPT)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| format!("Failed to spawn bun: {}", e))?;

    // Write request to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(request.as_bytes())
            .map_err(|e| format!("Failed to write to bridge: {}", e))?;
        // Drop stdin to close it so the child can finish reading
        drop(stdin);
    }

    // Read full stdout
    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to read bridge output: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let line = stdout.lines().next().unwrap_or("").trim().to_string();

    if !output.status.success() {
        return Err(format!(
            "Bridge exited with status {}: {}",
            output.status, line
        ));
    }

    Ok(line)
}

/// Build a JSON args object from string pairs.
fn args_map(pairs: &[(&str, &str)]) -> String {
    use std::collections::BTreeMap;
    let mut map = BTreeMap::new();
    for (k, v) in pairs {
        map.insert(k.to_string(), v.to_string());
    }
    serde_json::to_string(&map).unwrap_or_else(|_| "{}".to_string())
}

// ─── Tauri Commands ─────────────────────────────────────────────

#[tauri::command]
fn list_workspaces() -> Result<String, String> {
    call_bridge("list-workspaces", "{}")
}

#[tauri::command]
fn create_workspace(name: String) -> Result<String, String> {
    let args = args_map(&[("name", &name)]);
    call_bridge("create-workspace", &args)
}

#[tauri::command]
fn list_collections(workspace_id: String) -> Result<String, String> {
    let args = args_map(&[("workspaceId", &workspace_id)]);
    call_bridge("list-collections", &args)
}

#[tauri::command]
fn get_requests(collection_id: String) -> Result<String, String> {
    let args = args_map(&[("collectionId", &collection_id)]);
    call_bridge("get-requests", &args)
}

#[tauri::command]
fn execute_request(config_json: String) -> Result<String, String> {
    let args = format!("{{\"config\":{}}}", config_json);
    call_bridge("execute-request", &args)
}

#[tauri::command]
fn list_environments(workspace_id: String) -> Result<String, String> {
    let args = args_map(&[("workspaceId", &workspace_id)]);
    call_bridge("list-environments", &args)
}

#[tauri::command]
fn import_collection(json: String, workspace_id: Option<String>) -> Result<String, String> {
    let args = if let Some(ws) = &workspace_id {
        format!("{{\"json\":{},\"workspaceId\":\"{}\"}}", json, ws)
    } else {
        format!("{{\"json\":{}}}", json)
    };
    call_bridge("import-collection", &args)
}

// ─── Main ───────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_workspaces,
            create_workspace,
            list_collections,
            get_requests,
            execute_request,
            list_environments,
            import_collection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
