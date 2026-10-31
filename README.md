# AKHOA LUA PROTECTOR v1.1

## Render deploy
1. Upload this folder to a GitHub repository.
2. Render → New → Blueprint → connect the repository.
3. Render reads `render.yaml` and deploys the Node service.
4. Keep `ADMIN_KEY` secret in Render Environment. The blueprint generates a value.
5. Persistent disk is mounted at `/var/data`.

Manual settings: Node runtime, `npm install`, `npm start`, `DATA_DIR=/var/data`, `ADMIN_KEY=<long random secret>`, persistent disk mount `/var/data`.

## Flow
Choose `.lua` / `.luau` file → MÃ HÓA CODE → copy protected raw, copy protected view link, copy raw URL, or copy server-side Roblox Studio loader snippet.

`/view/:token` displays a page titled CODE ĐÃ ĐƯỢC BẢO VỆ. `/raw/:token` returns the processed Lua text.

## Security limitations
- The current obfuscator removes comments and redundant whitespace outside strings. It is not encryption and does not prevent reverse engineering.
- Anyone with a published URL can read the protected source. The token is a bearer secret, not identity-based access control.
- The generated loadstring snippet is for a trusted Roblox Studio server Script only. `loadstring` must be enabled for the server and carries serious risk; never use it for untrusted URLs. It is not an executor script.
- Keep secrets and important game logic on the server. Use ModuleScripts for normal Roblox code organization.
- JSON file storage is intended for a small personal workspace.
