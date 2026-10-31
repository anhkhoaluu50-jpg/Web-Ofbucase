const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, ".data");
const DB_FILE = path.join(DATA_DIR, "store.json");
const MAX_SOURCE = 512 * 1024;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 8;
const hits = new Map();
fs.mkdirSync(DATA_DIR, { recursive: true });
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req, res, next) => { res.set({ "X-Content-Type-Options":"nosniff", "X-Frame-Options":"DENY", "Referrer-Policy":"no-referrer", "Permissions-Policy":"camera=(), microphone=(), geolocation=()", "Cross-Origin-Resource-Policy":"same-site" }); next(); });
app.use(express.json({ limit: "600kb", strict: true }));
app.use(express.static(path.join(__dirname, "public"), { extensions:["html"], maxAge:"1h" }));
const r2Ready = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && process.env.R2_PUBLIC_BASE_URL);
const r2 = r2Ready ? new S3Client({ region:"auto", endpoint:`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials:{ accessKeyId:process.env.R2_ACCESS_KEY_ID, secretAccessKey:process.env.R2_SECRET_ACCESS_KEY } }) : null;
function readStore(){try{return JSON.parse(fs.readFileSync(DB_FILE,"utf8"))}catch{return {publishes:[]}}}
function writeStore(db){const tmp=DB_FILE+".tmp";fs.writeFileSync(tmp,JSON.stringify(db),{mode:0o600});fs.renameSync(tmp,DB_FILE)}
function makeToken(){return crypto.randomBytes(32).toString("hex")}
function cleanName(s){return String(s||"protected.lua").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,80)||"protected.lua"}
function validSource(s){return typeof s==="string"&&s.trim().length>0&&Buffer.byteLength(s,"utf8")<=MAX_SOURCE}
function rateLimit(req,res,next){const now=Date.now(),ip=String(req.ip||req.socket.remoteAddress||"unknown");if(hits.size>10000){for(const [key,value] of hits){if(now-value.start>WINDOW_MS)hits.delete(key)}if(hits.size>12000)hits.clear()}let item=hits.get(ip);if(!item||now-item.start>WINDOW_MS)item={start:now,count:0};item.count++;hits.set(ip,item);if(item.count>MAX_REQUESTS){res.set("Retry-After",String(Math.ceil((WINDOW_MS-(now-item.start))/1000)));return res.status(429).json({error:"Bạn thao tác quá nhanh. Hãy thử lại sau ít phút."})}next()}
// Formatting-only minifier; not encryption. Preserves quoted and long-bracket strings.
function obfuscateLua(input){let out="",i=0,quote=null,longLevel=null,lineComment=false;const word=c=>!!c&&/[A-Za-z0-9_]/.test(c);while(i<input.length){const c=input[i],n=input[i+1];if(lineComment){if(c==="\n"){lineComment=false;out+="\n"}i++;continue}if(longLevel!==null){const end="]"+"=".repeat(longLevel)+"]",at=input.indexOf(end,i);if(at<0){out+=input.slice(i);break}out+=input.slice(i,at+end.length);i=at+end.length;longLevel=null;continue}if(quote){out+=c;i++;if(c==="\\"&&i<input.length)out+=input[i++];else if(c===quote)quote=null;continue}if(c==="'"||c==='"'){quote=c;out+=c;i++;continue}if(c==="-"&&n==="-"){const m=input.slice(i+2).match(/^\[(=*)\[/);if(m){const level=m[1].length,start=i+2+m[0].length,end="]"+"=".repeat(level)+"]",at=input.indexOf(end,start);if(at>=0){i=at+end.length;continue}}lineComment=true;i+=2;continue}const lm=input.slice(i).match(/^\[(=*)\[/);if(c==="["&&lm){longLevel=lm[1].length;out+=lm[0];i+=lm[0].length;continue}if(/\s/.test(c)){let j=i+1;while(j<input.length&&/\s/.test(input[j]))j++;const prev=out[out.length-1],next=input[j];if(word(prev)&&word(next))out+=" ";else if((prev==="-"&&next==="-")||(prev==="."&&next===".")||(prev==="="&&next==="="))out+=" ";i=j;continue}out+=c;i++}return out.trim()+"\n"}
app.get("/api/health",(req,res)=>res.json({ok:true,service:"AKHOA LUA PROTECTOR",storage:r2Ready?"cloudflare-r2":"local-fallback"}));
app.post("/api/protect",rateLimit,async(req,res,next)=>{try{const {name,source,website}=req.body||{};if(website)return res.status(400).json({error:"Yêu cầu không hợp lệ."});if(!validSource(source))return res.status(400).json({error:"File trống hoặc vượt quá 512 KB."});const protectedSource=obfuscateLua(source),token=makeToken(),safeFileName=cleanName(name);let rawUrl;if(r2Ready){const key=`lua/${token}.lua`;await r2.send(new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:key,Body:Buffer.from(protectedSource,"utf8"),ContentType:"text/plain; charset=utf-8",CacheControl:"public, max-age=31536000, immutable",Metadata:{filename:safeFileName}}));rawUrl=`${process.env.R2_PUBLIC_BASE_URL.replace(/\/$/,"")}/${key}`}else{const db=readStore();db.publishes.unshift({token,name:safeFileName,source:protectedSource,createdAt:new Date().toISOString()});writeStore(db);rawUrl=`${req.protocol}://${req.get("host")}/raw/${token}`}const loaderSnippet=`-- Roblox Studio SERVER Script only. Not for executors.\n-- Enable LoadStringEnabled only if you understand the security implications.\nlocal RunService = game:GetService("RunService")\nassert(RunService:IsServer(), "This loader must run on the server")\nlocal HttpService = game:GetService("HttpService")\nlocal source = HttpService:GetAsync("${rawUrl}")\nlocal chunk, loadError = loadstring(source)\nassert(chunk, loadError)\nchunk()`;res.status(201).json({name:safeFileName,protectedSource,rawUrl,loaderSnippet,storage:r2Ready?"cloudflare-r2":"render-fallback"})}catch(err){next(err)}});
app.get("/raw/:token",(req,res)=>{const token=req.params.token;if(!/^[a-f0-9]{64}$/.test(token))return res.status(404).type("text").send("Source not found");const item=readStore().publishes.find(p=>p.token===token);if(!item)return res.status(404).type("text").send("Source not found");res.set({"Cache-Control":"no-store","Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'"});res.type("text/plain; charset=utf-8").send(item.source)});
app.use((err,req,res,next)=>{if(err&&err.type==="entity.too.large")return res.status(413).json({error:"Yêu cầu vượt quá giới hạn dung lượng."});console.error(err&&err.message?err.message:err);res.status(400).json({error:"Không thể xử lý yêu cầu. Kiểm tra file Lua/Luau rồi thử lại."})});
app.listen(PORT,()=>console.log(`AKHOA LUA PROTECTOR listening on ${PORT}; R2=${r2Ready}`));
