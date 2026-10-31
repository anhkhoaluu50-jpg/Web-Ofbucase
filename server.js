const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, ".data");
const DB_FILE = path.join(DATA_DIR, "store.json");
const ADMIN_KEY = process.env.ADMIN_KEY || "change-this-before-deploying";
const MAX_SOURCE = 512 * 1024;

fs.mkdirSync(DATA_DIR, { recursive: true });
app.disable("x-powered-by");
app.use(express.json({ limit: "600kb" }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

function readStore() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return { projects: [], publishes: [] }; }
}
function writeStore(db) {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function admin(req, res, next) {
  const key = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!key || !safeEqual(key, ADMIN_KEY)) return res.status(401).json({ error: "ADMIN_KEY không hợp lệ." });
  next();
}
function validSource(s) {
  return typeof s === "string" && s.trim().length > 0 && Buffer.byteLength(s, "utf8") <= MAX_SOURCE;
}
function cleanName(s) {
  return String(s || "protected").replace(/[<>\\/"'`]/g, "").trim().slice(0, 64) || "protected";
}
function makeToken() { return crypto.randomBytes(32).toString("hex"); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

// Safe formatting obfuscation only: strips comments and redundant whitespace outside strings.
// It does not encrypt Lua or guarantee that source cannot be recovered.
function obfuscateLua(input) {
  let out = "", i = 0, quote = null, longLevel = null, lineComment = false;
  const word = c => !!c && /[A-Za-z0-9_]/.test(c);
  while (i < input.length) {
    const c = input[i], n = input[i + 1];
    if (lineComment) { if (c === "\n") { lineComment = false; out += "\n"; } i++; continue; }
    if (longLevel !== null) {
      const end = "]" + "=".repeat(longLevel) + "]";
      const at = input.indexOf(end, i);
      if (at < 0) { out += input.slice(i); break; }
      out += input.slice(i, at + end.length); i = at + end.length; longLevel = null; continue;
    }
    if (quote) {
      out += c; i++;
      if (c === "\\" && i < input.length) out += input[i++];
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; out += c; i++; continue; }
    if (c === "-" && n === "-") {
      const m = input.slice(i + 2).match(/^\[(=*)\[/);
      if (m) {
        const level = m[1].length, start = i + 2 + m[0].length;
        const end = "]" + "=".repeat(level) + "]";
        const at = input.indexOf(end, start);
        if (at >= 0) { i = at + end.length; continue; }
      }
      lineComment = true; i += 2; continue;
    }
    const lm = input.slice(i).match(/^\[(=*)\[/);
    if (c === "[" && lm) { longLevel = lm[1].length; out += lm[0]; i += lm[0].length; continue; }
    if (/\s/.test(c)) {
      let j = i + 1; while (j < input.length && /\s/.test(input[j])) j++;
      const prev = out[out.length - 1], next = input[j];
      if (word(prev) && word(next)) out += " ";
      else if ((prev === "-" && next === "-") || (prev === "." && next === ".") || (prev === "=" && next === "=")) out += " ";
      i = j; continue;
    }
    out += c; i++;
  }
  return out.trim() + "\n";
}
function findPublish(t) {
  return readStore().publishes.find(p => safeEqual(p.token, t));
}
function protectedPage(item, rawUrl) {
  const code = escapeHtml(item.source);
  const raw = escapeHtml(rawUrl);
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Code đã được bảo vệ | AKHOA</title><style>
  *{box-sizing:border-box}body{margin:0;background:#0b0812;color:#f4efff;font-family:Arial,sans-serif;padding:28px 14px}.wrap{max-width:900px;margin:auto}.head,.card{background:#151020;border:1px solid #342447;border-radius:16px;padding:20px;margin-bottom:14px}.brand{color:#bd8bff;font-size:12px;letter-spacing:2px;font-weight:bold}.badge{display:inline-block;color:#7ce3b4;border:1px solid #326c55;background:#10251c;padding:6px 10px;border-radius:30px;font-size:10px;margin-top:14px}.title{font-size:27px;margin:14px 0 5px}.muted{color:#998ba8;font-size:12px;line-height:1.6}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:65vh;overflow:auto;background:#09070e;border:1px solid #2a2038;border-radius:10px;padding:16px;color:#cda9ff;font:12px/1.65 monospace}.btn{background:#7540b8;color:white;border:0;border-radius:9px;padding:11px 15px;font-weight:bold;cursor:pointer}.foot{font-size:10px;color:#71667e;text-align:center;margin:22px}</style></head><body><main class="wrap"><section class="head"><div class="brand">AKHOA / LUA PROTECTOR</div><div class="badge">● PROTECTED RELEASE</div><h1 class="title">CODE ĐÃ ĐƯỢC BẢO VỆ</h1><div class="muted">Tên bản phát hành: ${escapeHtml(item.name)}<br>Đây là bản source đã qua xử lý obfuscation cơ bản.</div></section><section class="card"><button class="btn" onclick="copyCode()">COPY RAW CODE</button><pre id="code">${code}</pre><p class="muted">Lưu ý: obfuscation không phải mã hóa tuyệt đối. Người có quyền xem source vẫn có thể phân tích hoặc sao chép nội dung.</p></section><div class="foot">AKHOA LUA PROTECTOR · PROTECTED SOURCE VIEW</div></main><script>function copyCode(){const s=document.getElementById('code').innerText;navigator.clipboard.writeText(s).then(()=>alert('Đã copy protected code')).catch(()=>alert('Không thể copy tự động trên trình duyệt này'))}</script></body></html>`;
}

app.get("/api/health", (req, res) => res.json({ ok: true, service: "AKHOA LUA PROTECTOR" }));
app.get("/api/auth/check", admin, (req, res) => res.json({ ok: true }));

app.post("/api/protect", admin, (req, res) => {
  const { name, source } = req.body || {};
  if (!validSource(source)) return res.status(400).json({ error: "File trống hoặc vượt quá 512 KB." });
  const protectedSource = obfuscateLua(source);
  const accessToken = makeToken();
  const item = { token: accessToken, name: cleanName(name), source: protectedSource, createdAt: new Date().toISOString() };
  const db = readStore(); db.publishes.unshift(item); writeStore(db);
  const base = `${req.protocol}://${req.get("host")}`;
  const rawUrl = `${base}/raw/${accessToken}`;
  const viewUrl = `${base}/view/${accessToken}`;
  const loadstringSnippet =
`-- Roblox Studio: chỉ chạy trong Script phía server.
-- Bật LoadStringEnabled chỉ khi bạn hiểu rõ rủi ro và tin tưởng URL này.
local HttpService = game:GetService("HttpService")
local source = HttpService:GetAsync("${rawUrl}")
local fn, err = loadstring(source)
assert(fn, err)
fn()`;
  res.status(201).json({ name: item.name, protectedSource, rawUrl, viewUrl, loadstringSnippet });
});

app.get("/view/:token", (req, res) => {
  const item = findPublish(req.params.token);
  if (!item) return res.status(404).type("text").send("Protected source not found");
  res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
  res.type("html").send(protectedPage(item, `/raw/${item.token}`));
});
app.get("/raw/:token", (req, res) => {
  const item = findPublish(req.params.token);
  if (!item) return res.status(404).type("text").send("Protected source not found");
  res.set({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer"
  });
  res.send(item.source);
});

// Workspace API retained for project storage.
app.get("/api/projects", admin, (req, res) => res.json(readStore().projects.map(({source,...p})=>({...p,size:Buffer.byteLength(source||"","utf8")}))));
app.post("/api/projects", admin, (req,res)=>{
  const {name,source}=req.body||{}; if(!validSource(source))return res.status(400).json({error:"Code trống hoặc vượt quá 512 KB."});
  const db=readStore(),p={id:crypto.randomBytes(12).toString("hex"),name:cleanName(name),source,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  db.projects.unshift(p);writeStore(db);res.status(201).json({id:p.id,name:p.name,updatedAt:p.updatedAt});
});
app.get("/api/projects/:id",admin,(req,res)=>{const p=readStore().projects.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({error:"Không tìm thấy project."});res.json(p)});
app.put("/api/projects/:id",admin,(req,res)=>{const db=readStore(),p=db.projects.find(x=>x.id===req.params.id),{name,source}=req.body||{};if(!p)return res.status(404).json({error:"Không tìm thấy project."});if(!validSource(source))return res.status(400).json({error:"Code trống hoặc vượt quá 512 KB."});p.name=cleanName(name);p.source=source;p.updatedAt=new Date().toISOString();writeStore(db);res.json({id:p.id,name:p.name,updatedAt:p.updatedAt})});
app.delete("/api/projects/:id",admin,(req,res)=>{const db=readStore(),n=db.projects.length;db.projects=db.projects.filter(p=>p.id!==req.params.id);if(n===db.projects.length)return res.status(404).json({error:"Không tìm thấy project."});writeStore(db);res.json({ok:true})});

app.use((err,req,res,next)=>{console.error(err.message);res.status(400).json({error:"Yêu cầu không hợp lệ."})});
app.listen(PORT,()=>console.log(`AKHOA LUA PROTECTOR listening on ${PORT}`));
