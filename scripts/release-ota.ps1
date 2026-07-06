param(
  [Parameter(Mandatory = $true)]
  [string]$VersionName,

  [string]$Notes = '',
  [string]$Bucket = 'app-updates',

  [switch]$SkipBuild,
  [switch]$SkipUpload
)

$ErrorActionPreference = 'Stop'

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,

    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,

    [Parameter(Mandatory = $true)]
    [string]$Description
  )

  Write-Host "`n==> $Description" -ForegroundColor Cyan
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command $($Arguments -join ' ')"
  }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot 'android'
$buildGradlePath = Join-Path $projectRoot 'android/app/build.gradle'

if (!(Test-Path $buildGradlePath)) {
  throw "Missing file: $buildGradlePath"
}

$buildGradleRaw = Get-Content -Path $buildGradlePath -Raw

$versionCodeMatch = [regex]::Match($buildGradleRaw, 'versionCode\s+(\d+)')
$versionNameMatch = [regex]::Match($buildGradleRaw, 'versionName\s+"([^"]+)"')

if (!$versionCodeMatch.Success -or !$versionNameMatch.Success) {
  throw 'Could not parse versionCode/versionName from android/app/build.gradle'
}

$currentVersionCode = [int]$versionCodeMatch.Groups[1].Value
$currentVersionName = $versionNameMatch.Groups[1].Value
$newVersionCode = $currentVersionCode + 1

$updatedGradle = $buildGradleRaw
$updatedGradle = [regex]::Replace($updatedGradle, 'versionCode\s+\d+', "versionCode $newVersionCode", 1)
$updatedGradle = [regex]::Replace($updatedGradle, 'versionName\s+"[^"]+"', "versionName `"$VersionName`"", 1)

if ($updatedGradle -ne $buildGradleRaw) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($buildGradlePath, $updatedGradle, $utf8NoBom)
}

Write-Host "Current version: $currentVersionName ($currentVersionCode)"
Write-Host "New version: $VersionName ($newVersionCode)"

if (-not $SkipBuild) {
  Set-Location $projectRoot
  Invoke-Step -Command 'npm' -Arguments @('run', 'build') -Description 'Building web assets'
  Invoke-Step -Command 'npx' -Arguments @('cap', 'sync', 'android') -Description 'Syncing Capacitor Android'

  Set-Location $androidRoot
  Invoke-Step -Command '.\gradlew.bat' -Arguments @('assembleRelease') -Description 'Building Android release APK'
}

if (-not $SkipUpload) {
  Set-Location $projectRoot

  $apkLocalPath = Join-Path $projectRoot 'android/app/build/outputs/apk/release/app-release.apk'
  $apkUploadSource = 'android/app/build/outputs/apk/release/app-release.apk'
  if (!(Test-Path $apkLocalPath)) {
    throw "Release APK not found: $apkLocalPath"
  }

  $apkFileName = "mi-batida-v$VersionName-release.apk"
  $apkStoragePath = "ss:///$Bucket/$apkFileName"
  $apkPublicUrl = "https://abdwszaejrzqtjlvhakw.supabase.co/storage/v1/object/public/$Bucket/$apkFileName"

  Invoke-Step -Command 'npx' -Arguments @(
    'supabase', '--experimental', 'storage', 'cp',
    $apkUploadSource, $apkStoragePath,
    '--linked',
    '--content-type', 'application/vnd.android.package-archive',
    '--cache-control', 'no-cache'
  ) -Description 'Uploading APK to Supabase Storage'

  # Rotate latest.json if it exists.
  & npx supabase --experimental storage mv "ss:///$Bucket/latest.json" "ss:///$Bucket/latest-$currentVersionName.json" --linked
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'latest.json rotation skipped (not present or already moved).' -ForegroundColor Yellow
  }

  $releaseNotes = if ([string]::IsNullOrWhiteSpace($Notes)) { "Release $VersionName" } else { $Notes }
  $manifest = [ordered]@{
    latestVersion = $VersionName
    apkUrl = $apkPublicUrl
    notes = $releaseNotes
  }

  $manifestLocalPath = Join-Path $projectRoot 'latest.json'
  $manifestUploadSource = 'latest.json'
  $manifestJson = $manifest | ConvertTo-Json
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($manifestLocalPath, $manifestJson, $utf8NoBom)

  Invoke-Step -Command 'npx' -Arguments @(
    'supabase', '--experimental', 'storage', 'cp',
    $manifestUploadSource, "ss:///$Bucket/latest.json",
    '--linked',
    '--content-type', 'application/json',
    '--cache-control', 'no-cache'
  ) -Description 'Uploading latest.json manifest'

  Write-Host "`nRelease published:" -ForegroundColor Green
  Write-Host "- Version: $VersionName ($newVersionCode)"
  Write-Host "- APK URL: $apkPublicUrl"
  Write-Host "- Manifest URL: https://abdwszaejrzqtjlvhakw.supabase.co/storage/v1/object/public/$Bucket/latest.json"
}
