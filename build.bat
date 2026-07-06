@echo off
setlocal

cd /d c:\pruebasinbolt\project

echo [1/5] Build web...
call npm run build || goto :error

echo [2/5] Sync Capacitor Android...
call npx cap sync android || goto :error

echo [3/5] Force Java 17 in generated Capacitor gradle files...
powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Content 'c:\pruebasinbolt\project\android\app\capacitor.build.gradle' -Raw) -replace 'JavaVersion\.VERSION_21','JavaVersion.VERSION_17' | Set-Content 'c:\pruebasinbolt\project\android\app\capacitor.build.gradle' -NoNewline" || goto :error
powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Content 'c:\pruebasinbolt\project\android\capacitor-cordova-android-plugins\build.gradle' -Raw) -replace 'JavaVersion\.VERSION_21','JavaVersion.VERSION_17' | Set-Content 'c:\pruebasinbolt\project\android\capacitor-cordova-android-plugins\build.gradle' -NoNewline" || goto :error

echo [4/5] Build Android debug APK...
cd /d c:\pruebasinbolt\project\android
call .\gradlew.bat assembleDebug || goto :error

echo [5/5] Build Android release APK...
call .\gradlew.bat assembleRelease || goto :error

echo.
echo Build completed successfully.
echo Debug APK: c:\pruebasinbolt\project\android\app\build\outputs\apk\debug\app-debug.apk
echo Release APK: c:\pruebasinbolt\project\android\app\build\outputs\apk\release\app-release-unsigned.apk
goto :end

:error
echo.
echo Build failed.
exit /b 1

:end
endlocal
