# Changelog

All notable changes to this project.

## [3.0.1] - 2026-11-13

### Fixed
- `opencode_stats` now uses the CLI's boolean `--tools`/`--models` section flags and a single `--limit` row count, instead of passing the counts as flag values and printing help.
- OpenCode subprocesses now use the login home and XDG paths instead of the cell's isolated runtime HOME. This lets `opencode_mcp_list` connect to the existing managed service rather than failing when it tries to bind port 49374 again.

## [3.0.0] - 2026-10-31

### Changed
- **Version reset to 3.0.0** — per-server version metadata baseline reset (Phase 7). All `package.json`, MCP `ServerInfo.version`, and HTTP metadata now report `3.0.0`. This is a metadata/interface baseline reset; for `hela-plastid` it is not an upgrade from the previous `4.2.0` advert.

