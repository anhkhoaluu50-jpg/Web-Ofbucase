# AKHOA LUA PROTECTOR v1.2

Giao diện: chọn file `.lua` / `.luau` / `.txt` → xử lý/minify → tạo RAW LINK → sao chép Studio Loader. Không yêu cầu Admin Key cho người dùng website.

## Deploy lên Render
1. Đưa thư mục này lên GitHub.
2. Render → New → Blueprint → kết nối repository.
3. Render cài dependencies bằng `npm install` và chạy `npm start`.
4. Không cần ADMIN_KEY.

## Để RAW LINK vẫn hoạt động khi Render ngủ
Cần cấu hình Cloudflare R2 một lần:
1. Tạo R2 bucket.
2. Tạo R2 API token có quyền Object Read & Write chỉ trên bucket đó.
3. Bật public access qua custom domain của bucket (khuyến nghị) hoặc URL public phù hợp.
4. Trong Render → Environment, đặt các biến:
   - `R2_ACCOUNT_ID`: Cloudflare account ID
   - `R2_ACCESS_KEY_ID`: R2 access key ID
   - `R2_SECRET_ACCESS_KEY`: R2 secret access key
   - `R2_BUCKET`: tên bucket
   - `R2_PUBLIC_BASE_URL`: URL public gốc, ví dụ `https://lua-cdn.example.com`
5. Deploy lại. `/api/health` sẽ báo `cloudflare-r2` khi cấu hình đủ.

Khi R2 đã cấu hình, file Lua được tải thẳng lên R2 và RAW LINK trỏ thẳng tới R2/CDN, không cần Render hoạt động để phục vụ file. Render vẫn cần thức khi người dùng mở website và gửi file mới để xử lý. Không thể bảo đảm dịch vụ miễn phí tồn tại vĩnh viễn; độ bền phụ thuộc tài khoản, bucket, domain, giới hạn và chính sách Cloudflare.

Nếu không cấu hình R2, hệ thống dùng lưu trữ dự phòng cục bộ trên Render. Với Render Free, không nên coi file cục bộ là lưu trữ lâu dài và link có thể không hoạt động khi service ngủ hoặc filesystem bị thay thế.

## Roblox Studio
- Loader được tạo là mẫu cho **Script phía server trong Roblox Studio**, không phải Delta hay executor.
- Bật HTTP Requests và `LoadStringEnabled` chỉ khi hiểu rủi ro và chỉ tải source bạn hoàn toàn tin tưởng.
- Roblox tải source dưới dạng văn bản Lua/Luau thuần từ RAW LINK. Loader dùng `HttpService:GetAsync` rồi `loadstring` ở server.
- Không đưa bí mật vào source công khai. Người có RAW LINK đều có thể đọc và sao chép.

## Bảo mật và giới hạn
- Không có Admin Key để người dùng thao tác. Backend có giới hạn 8 lần tạo link / 10 phút / IP, giới hạn body và trường honeypot cơ bản.
- R2 credentials chỉ nằm trong biến môi trường server, tuyệt đối không đưa vào frontend.
- Bộ xử lý chỉ bỏ comment và khoảng trắng dư thừa ngoài chuỗi. Đây không phải mã hóa, không bảo vệ tuyệt đối, và có thể không phù hợp với mọi cú pháp hoặc directive đặc biệt. Hãy kiểm tra kỹ code sau xử lý trước khi dùng.
- Public RAW URL là bearer link: bất kỳ ai có link đều đọc được. Có thể xóa object trong R2 để thu hồi.
- Rate limit cơ bản không thể ngăn mọi bot hoặc tấn công phân tán. Muốn chống bot mạnh hơn, bật Cloudflare proxy/WAF/rate limiting trước website.
