# 🚀 วิธีเอาเว็บ Icewood Cues ขึ้น GitHub Pages

## ขั้นตอนทั้งหมด (~10 นาที)

---

### ก่อนเริ่ม: ติดตั้ง Git (ถ้ายังไม่มี)
ดาวน์โหลด Git: https://git-scm.com/download/win  
ติดตั้งตามค่า default ได้เลย

---

### Step 1 — สร้าง GitHub Account & Repo
1. ไปที่ https://github.com → Sign up (ถ้ายังไม่มี account)
2. กด **New repository** (ปุ่มสีเขียว)
3. ตั้งชื่อ: `icewoodcues` (หรือชื่ออื่นก็ได้)
4. เลือก **Public**
5. **อย่าติ๊ก** Initialize README
6. กด **Create repository**
7. Copy URL ของ repo เช่น `https://github.com/YOUR_USERNAME/icewoodcues.git`

---

### Step 2 — รัน deploy.bat
1. ดับเบิลคลิก **deploy.bat** ในโฟลเดอร์ `CuesBrand OS Pro`
2. รอให้รันเสร็จ จะขึ้นข้อความว่า DONE

---

### Step 3 — Push ขึ้น GitHub
เปิด Command Prompt (cmd) ใน Windows แล้วรัน:

```bash
cd "D:\Icewood cues\CuesBrand OS Pro"

# เปลี่ยน YOUR_USERNAME เป็น username GitHub ของคุณ
git remote add origin https://github.com/YOUR_USERNAME/icewoodcues.git
git push -u origin main
```

ระบบจะขอ Login GitHub → ใส่ username + password

---

### Step 4 — เปิด GitHub Pages
1. ใน GitHub → repo ของคุณ → **Settings**
2. เลือก **Pages** (ในเมนูซ้าย)
3. Source: **Deploy from a branch**
4. Branch: **main** → Folder: **/ (root)**
5. กด **Save**
6. รอ 1-2 นาที → เว็บจะขึ้นที่:

```
https://YOUR_USERNAME.github.io/icewoodcues/
```

---

## หลัง Deploy: สิ่งที่ต้องทำ

### 🔧 แก้ URL ใน icewood.html
เปิดไฟล์ `icewood.html` แล้วค้นหาและแก้:
- `https://icewoodcues.github.io/` → URL จริงของคุณ
- `G-XXXXXXXXXX` → Google Analytics Measurement ID (ถ้ามี)

### 📊 Google Analytics (ไม่บังคับ)
1. ไปที่ https://analytics.google.com
2. สร้าง Property ใหม่
3. Copy **Measurement ID** (G-XXXXXXXXXX)
4. แก้ใน icewood.html บรรทัดที่มี `G-XXXXXXXXXX` (มีสองที่)

### 📲 LINE แจ้งเตือนออเดอร์ (Messaging API)
> ⚠️ LINE Notify ปิดบริการแล้ว (มี.ค. 2025) — ใช้ Messaging API แทน

1. ไปที่ https://developers.line.biz → สร้าง Provider + Channel แบบ **Messaging API**
2. ในแท็บ Messaging API → กด **Issue** ที่ Channel access token → Copy
3. หา userId ของคุณ (แท็บ Basic settings → Your user ID) หรือ groupId ของกลุ่ม
4. เปิด `Code.gs` แก้สองบรรทัดนี้:
   ```javascript
   const LINE_CHANNEL_TOKEN = 'ใส่ channel access token';
   const LINE_TARGET_ID     = 'ใส่ userId หรือ groupId';
   ```
5. เพิ่มบอทเป็นเพื่อน (สแกน QR ในแท็บ Messaging API) เพื่อให้ส่งหาคุณได้
   (เว้นว่างทั้งสองค่า = ปิดแจ้งเตือน ระบบยังทำงานปกติ)

### 🗂️ Google Sheets Backend
1. ไปที่ https://script.google.com → New project
2. วาง Code.gs ทั้งหมด
3. แก้ `SHEET_ID` เป็น Google Sheet ID ของคุณ
4. Deploy → Web app → Execute as: Me / Anyone
5. Copy URL → วางใน `icewood.html` ช่อง `gasUrl`

---

## อัพเดทเว็บหลัง Deploy

```bash
cd "D:\Icewood cues\CuesBrand OS Pro"
copy /Y icewood.html index.html
git add -A
git commit -m "Update website"
git push
```

เว็บจะอัพเดทอัตโนมัติใน 1-2 นาที

---

## ปัญหาที่พบบ่อย

**git ไม่รู้จัก**  
→ ปิด cmd แล้วเปิดใหม่หลังติดตั้ง Git

**push แล้ว ขอ password แต่ใส่ไม่ได้**  
→ GitHub ใช้ Personal Access Token แทน password  
→ Settings → Developer settings → Personal access tokens → Generate new token (classic) → ติ๊ก `repo` → Copy token มาใส่แทน password

**เว็บขึ้นแต่ CSS ไม่โหลด**  
→ URL ใน `<base href>` อาจผิด ลอง Hard refresh (Ctrl+Shift+R)
