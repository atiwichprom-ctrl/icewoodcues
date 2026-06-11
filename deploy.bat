@echo off
chcp 65001 >nul
echo ╔══════════════════════════════════════════════════════╗
echo ║  ICEWOOD CUES — GitHub Pages Deploy Script         ║
echo ╚══════════════════════════════════════════════════════╝
echo.

:: Check git
where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] ยังไม่มี Git — ดาวน์โหลดที่: https://git-scm.com/download/win
    pause & exit
)

:: Copy icewood.html → index.html
echo [1/5] Copy icewood.html → index.html
copy /Y "icewood.html" "index.html" >nul
echo     OK

:: Init git if not already
if not exist ".git" (
    echo [2/5] Init git repository
    git init
    git branch -M main
) else (
    echo [2/5] Git already initialized
)

:: Stage all
echo [3/5] Stage files
git add index.html icewood.html Code.gs DEPLOY_GITHUB.md

:: Commit
echo [4/5] Commit
git commit -m "Deploy Icewood Cues website" --allow-empty

echo.
echo [5/5] DONE — ขั้นตอนต่อไป:
echo.
echo   A) ไปที่ https://github.com/new
echo      สร้าง repo ชื่อ "icewoodcues" (Public)
echo.
echo   B) copy คำสั่งด้านล่างไปรัน:
echo      git remote add origin https://github.com/YOUR_USERNAME/icewoodcues.git
echo      git push -u origin main
echo.
echo   C) ใน GitHub: Settings → Pages → Source: main → / (root)
echo      เว็บจะขึ้นใน 1-2 นาทีที่ https://YOUR_USERNAME.github.io/icewoodcues/
echo.
pause
