const $=id=>document.getElementById(id);
let adminKey=sessionStorage.getItem("akhoa_admin_key")||"", selectedFile=null, protectedResult=null;
const source=$("source");
function notice(msg,error=false){const n=$("notice");n.textContent=msg;n.className="notice show"+(error?" error":"");clearTimeout(notice.t);notice.t=setTimeout(()=>n.className="notice",5000)}
function auth(){return {"Content-Type":"application/json","Authorization":"Bearer "+adminKey}}
async function api(url,opt={}){const r=await fetch(url,{...opt,headers:{...auth(),...(opt.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Request failed");return d}
function setFile(file){if(!file)return;if(!/\.(lua|luau|txt)$/i.test(file.name)){notice("Chỉ nhận file .lua, .luau hoặc .txt.",true);return}if(file.size>512*1024){notice("File vượt quá giới hạn 512 KB.",true);return}selectedFile=file;$("fileName").textContent=file.name;$("fileMeta").textContent=(file.size/1024).toFixed(1)+" KB · Ready to protect";source.value="";const reader=new FileReader();reader.onload=()=>{source.value=String(reader.result||"");$("sourceSize").textContent=new Blob([source.value]).size.toLocaleString()+" bytes";notice("Đã nạp "+file.name)};reader.onerror=()=>notice("Không đọc được file.",true);reader.readAsText(file)}
$("importBtn").onclick=$("browseBtn").onclick=()=>$("fileInput").click();
$("fileInput").onchange=e=>{setFile(e.target.files[0]);e.target.value=""};
const dz=$("dropZone");dz.ondragover=e=>{e.preventDefault();dz.classList.add("drag")};dz.ondragleave=()=>dz.classList.remove("drag");dz.ondrop=e=>{e.preventDefault();dz.classList.remove("drag");setFile(e.dataTransfer.files[0])};
source.oninput=()=>$("sourceSize").textContent=new Blob([source.value]).size.toLocaleString()+" bytes";
$("clearBtn").onclick=()=>{source.value="";selectedFile=null;$("fileName").textContent="No file selected";$("fileMeta").textContent="Choose a source file to begin";$("sourceSize").textContent="0 bytes";$("resultPanel").hidden=true};
$("settingsBtn").onclick=()=>$("settingsDialog").showModal();
$("connectBtn").onclick=async()=>{const k=$("adminKey").value.trim();if(!k)return notice("Nhập ADMIN_KEY.",true);adminKey=k;sessionStorage.setItem("akhoa_admin_key",k);try{await api("/api/auth/check");$("settingsDialog").close();notice("Đã lưu admin key. Sẵn sàng mã hóa.");}catch(e){notice(e.message,true)}};
$("protectBtn").onclick=async()=>{
 if(!source.value.trim())return notice("Hãy chọn file Lua/Luau trước.",true);
 if(!adminKey){$("settingsDialog").showModal();return}
 if(new Blob([source.value]).size>512*1024)return notice("Source vượt quá 512 KB.",true);
 $("protectBtn").disabled=true;$("protectBtn").textContent="PROCESSING...";
 try{
  protectedResult=await api("/api/protect",{method:"POST",body:JSON.stringify({name:selectedFile?selectedFile.name:"protected.luau",source:source.value})});
  $("protectedCode").textContent=protectedResult.protectedSource;$("viewUrl").value=protectedResult.viewUrl;$("rawUrl").value=protectedResult.rawUrl;$("loaderCode").textContent=protectedResult.loadstringSnippet;
  $("resultPanel").hidden=false;$("resultPanel").scrollIntoView({behavior:"smooth",block:"start"});notice("Hoàn tất! Protected source và link đã được tạo.");
 }catch(e){notice(e.message,true)}
 finally{$("protectBtn").disabled=false;$("protectBtn").textContent="🔐 MÃ HÓA CODE"}
};
async function copy(text,label){try{await navigator.clipboard.writeText(text);notice("Đã copy "+label)}catch{notice("Không thể copy. Hãy kiểm tra quyền clipboard.",true)}}
$("copyRawBtn").onclick=()=>copy(protectedResult?.protectedSource||"","RAW CODE");
$("copyViewBtn").onclick=()=>copy($("viewUrl").value,"PROTECTED LINK");
$("copyRawUrlBtn").onclick=()=>copy($("rawUrl").value,"RAW URL");
$("copyLoaderBtn").onclick=()=>copy(protectedResult?.loadstringSnippet||"","LOADSTRING");
$("openViewBtn").onclick=()=>window.open($("viewUrl").value,"_blank","noopener");
$("downloadBtn").onclick=()=>{if(!protectedResult)return;const b=new Blob([protectedResult.protectedSource],{type:"text/plain;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="protected_"+(selectedFile?.name||"source.lua").replace(/[^a-zA-Z0-9._-]/g,"_");a.click();URL.revokeObjectURL(a.href)};
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===t));["raw","link","loader"].forEach(k=>$(k+"Tab").hidden=k!==t.dataset.tab)});
function guide(title,html){$("guideTitle").textContent=title;$("guideContent").innerHTML=html;$("guideDialog").showModal()}
$("studioBtn").onclick=()=>guide("ROBLOX STUDIO INTEGRATION","<p>Đặt source đã export vào một <b>ModuleScript</b> trong Roblox Studio.</p><pre>-- ServerScriptService/Example.server.lua\nlocal MyModule = require(game.ServerScriptService.MyModule)\nMyModule.start()</pre><p>Giữ logic quan trọng ở server và kiểm tra mọi dữ liệu client gửi lên.</p>");
$("securityBtn").onclick=()=>guide("SOURCE PROTECTION GUIDE","<ul><li>Obfuscation chỉ làm khó đọc, không phải encryption.</li><li>Người có source vẫn có thể sao chép hoặc phân tích.</li><li>Không nhúng token, mật khẩu hoặc API key trong Lua gửi xuống client.</li><li>Link protected là bearer link: ai có URL đều có thể xem.</li><li>Loader mẫu dùng loadstring chỉ dành cho server Script Roblox Studio, không dành cho executor.</li></ul>");
