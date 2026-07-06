Param(
  [string]$ImagesRoot = "./docs/video",
  [string]$AudioPath = "./docs/video/narracion-video-completa-larga.wav",
  [string]$OutputPath = "./docs/video/video-narracion-completa-larga.mp4"
)

$imageFiles = @(
  "frames-5min/01-menu.png",
  "frames-5min/02-crear.png",
  "frames-5min/03-unirse.png",
  "frames-5min/04-activa.png",
  "frames-5min/05-mapa.png",
  "frames-5min/06-registro.png",
  "frames-5min/07-totales.png",
  "frames-5min/08-chat.png",
  "frames-5min/09-alerta.png",
  "frames-5min/10-batida-info.png",
  "frames-5min/11-perfil-interno.png",
  "frames-5min/12-home-o-menu.png",
  "frames-complete/01-batida-activa.png",
  "frames-complete/02-mapa.png",
  "frames-complete/03-mapa-filtros.png",
  "frames-complete/04-registro.png",
  "frames-complete/05-totales.png",
  "frames-complete/06-chat.png",
  "frames-complete/07-alerta.png",
  "frames-complete/08-batida.png",
  "frames-complete/09-perfil.png",
  "frames-complete/10-perfil-mapas-offline.png"
)

if (-not (Test-Path $AudioPath)) {
  Write-Error "No existe el audio en: $AudioPath"
  exit 1
}

$resolvedImagesRoot = (Resolve-Path $ImagesRoot).Path
$resolvedAudio = (Resolve-Path $AudioPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)

$tempList = Join-Path $env:TEMP "mibatida-video-list.txt"
$durationSeconds = 25

$lines = New-Object System.Collections.Generic.List[string]
foreach ($relativeFile in $imageFiles) {
  $fullPath = Join-Path $resolvedImagesRoot $relativeFile
  if (-not (Test-Path $fullPath)) {
    Write-Error "No existe la captura: $fullPath"
    exit 1
  }

  $ffmpegPath = $fullPath -replace '\\', '/'
  $lines.Add("file '$ffmpegPath'")
  $lines.Add("duration $durationSeconds")
}

$lastPath = (Join-Path $resolvedImagesRoot $imageFiles[-1]) -replace '\\', '/'
$lines.Add("file '$lastPath'")

Set-Content -Path $tempList -Value $lines -Encoding ASCII

New-Item -ItemType Directory -Path (Split-Path -Path $resolvedOutput -Parent) -Force | Out-Null

$ffmpegArgs = @(
  '-y',
  '-f', 'concat',
  '-safe', '0',
  '-i', $tempList,
  '-i', $resolvedAudio,
  '-filter_complex', '[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p[v]',
  '-map', '[v]',
  '-map', '1:a',
  '-c:v', 'libx264',
  '-r', '30',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-movflags', '+faststart',
  '-shortest',
  $resolvedOutput
)

& ffmpeg @ffmpegArgs

if ($LASTEXITCODE -ne 0) {
  Write-Error "FFmpeg fallo al generar el video."
  exit $LASTEXITCODE
}

Write-Host "Video generado en: $resolvedOutput"