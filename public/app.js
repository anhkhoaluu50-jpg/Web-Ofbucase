const $=id=>document.getElementById(id);
let selectedFile=null, protectedResult=null;
const source=$("source");
function notice(msg,error=false){const n=$("notice");n.textContent=msg;n.className="notice show"+(error?" error":"");clearTimeout(notice.t);notice.t=setTimeout(()=>n.className="notice",5000)}
async function api(url,opt={}){const r=await fetch(url,{...opt,headers:{"Content-Type":"application/json",...(opt.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Request failed");return d}
function setFile(file){if(!file)return;if(!/\.(lua|luau|txt)$/i.test(file.name)){notice("Chỉ nhận file .lua, .luau hoặc .txt.",true);return}if(file.size>512*1024){notice("File vượt quá giới hạn 512 KB.",true);return}selectedFile=file;$("fileName").textContent=file.name;$("fileMeta").textContent=(file.size/1024).toFixed(1)+" KB · Ready to protect";source.value="";const reader=new FileReader();reader.onload=()=>{source.value=String(reader.result||"");$("sourceSize").textContent=new Blob([source.value]).size.toLocaleString()+" bytes";notice("Đã nạp "+file.name)};reader.onerror=()=>notice("Không đọc được file.",true);reader.readAsText(file)}
$("importBtn").onclick=$("browseBtn").onclick=()=>$("fileInput").click();
$("fileInput").onchange=e=>{setFile(e.target.files[0]);e.target.value=""};
const dz=$("dropZone");dz.ondragover=e=>{e.preventDefault();dz.classList.add("drag")};dz.ondragleave=()=>dz.classList.remove("drag");dz.ondrop=e=>{e.preventDefault();dz.classList.remove("drag");setFile(e.dataTransfer.files[0])};
source.oninput=()=>$("sourceSize").textContent=new Blob([source.value]).size.toLocaleString()+" bytes";
$("clearBtn").onclick=()=>{source.value="";selectedFile=null;protectedResult=null;$("fileName").textContent="No file selected";$("fileMeta").textContent="Choose a source file to begin";$("sourceSize").textContent="0 bytes";$("resultPanel").hidden=true};
$("protectBtn").onclick=async()=>{
 if(!source.value.trim())return notice("Hãy chọn file Lua/Luau trước.",true);
 if(new Blob([source.value]).size>512*1024)return notice("Source vượt quá 512 KB.",true);
 $("protectBtn").disabled=true;$("protectBtn").textContent="PROCESSING...";
 try{
  protectedResult=await api("/api/protect",{method:"POST",body:JSON.stringify({name:selectedFile?selectedFile.name:"protected.lua",source:source.value,website:$("website").value})});
  $("protectedCode").textContent=protectedResult.protectedSource;$("rawUrl").value=protectedResult.rawUrl;$("loaderCode").textContent=protectedResult.loaderSnippet;
  $("storageNote").textContent=protectedResult.storage==="cloudflare-r2"?"Đã lưu trên Cloudflare R2: link RAW không phụ thuộc Render đang ngủ.":"Đang dùng lưu trữ dự phòng trên Render. Muốn link tiếp tục hoạt động khi Render ngủ, hãy cấu hình Cloudflare R2 theo README.";
  $("resultPanel").hidden=false;$("resultPanel").scrollIntoView({behavior:"smooth",block:"start"});notice("Hoàn tất! RAW LINK và Studio loader đã được tạo.");
 }catch(e){notice(e.message,true)}finally{$("protectBtn").disabled=false;$("protectBtn").textContent="🔐 MÃ HÓA CODE"}
};
async function copy(text,label){try{await navigator.clipboard.writeText(text);notice("Đã copy "+label)}catch{notice("Không thể copy. Hãy kiểm tra quyền clipboard.",true)}}
$("copyRawBtn").onclick=()=>copy(protectedResult?.protectedSource||"","RAW CODE");
$("copyRawUrlBtn").onclick=()=>copy($("rawUrl").value,"RAW LINK");
$("copyLoaderBtn").onclick=()=>copy(protectedResult?.loaderSnippet||"","STUDIO LOADER");
$("downloadBtn").onclick=()=>{if(!protectedResult)return;const b=new Blob([protectedResult.protectedSource],{type:"text/plain;charset=utf-8"});const a=document.createElement("a");const u=URL.createObjectURL(b);a.href=u;a.download="protected_"+(selectedFile?.name||"source.lua").replace(/[^a-zA-Z0-9._-]/g,"_");a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===t));["raw","link","loader"].forEach(k=>$(k+"Tab").hidden=k!==t.dataset.tab)});
function guide(title,html){$("guideTitle").textContent=title;$("guideContent").innerHTML=html;$("guideDialog").showModal()}
$("studioBtn").onclick=()=>guide("ROBLOX STUDIO INTEGRATION","<p>Đặt đoạn Studio Loader trong một <b>Script</b> phía server, ví dụ trong ServerScriptService. Bật HTTP Requests và LoadStringEnabled trong cấu hình game. Chỉ tải source do bạn kiểm soát.</p><p>Nếu code là module cần trả về một giá trị, hãy dùng ModuleScript và require theo cách Roblox thông thường thay vì gọi chunk trực tiếp.</p>");
$("securityBtn").onclick=()=>guide("SOURCE PROTECTION GUIDE","<ul><li>Minify chỉ làm gọn source, không phải encryption.</li><li>Ai có RAW LINK đều có thể đọc hoặc sao chép mã.</li><li>Không nhúng token, mật khẩu hoặc API key trong Lua.</li><li>Cloudflare R2 lưu file độc lập với Render; link public không thể thu hồi nếu chưa xóa object hoặc chặn domain.</li><li>Studio Loader chỉ chạy trong server Script được hỗ trợ, không dành cho executor.</li></ul>");
