Param(
  [string]$InputTextPath = "./docs/video/narracion-video-completo.txt",
  [string]$OutputAudioPath = "./docs/video/narracion-video-completo.wav"
)

Add-Type -AssemblyName System.Speech

if (-not (Test-Path $InputTextPath)) {
  Write-Error "No existe el texto de narracion en: $InputTextPath"
  exit 1
}

$texto = Get-Content -Path $InputTextPath -Raw -Encoding UTF8
if ([string]::IsNullOrWhiteSpace($texto)) {
  Write-Error "El texto de narracion esta vacio."
  exit 1
}

$fullOutput = Resolve-Path -Path (Split-Path -Path $OutputAudioPath -Parent) -ErrorAction SilentlyContinue
if (-not $fullOutput) {
  New-Item -ItemType Directory -Path (Split-Path -Path $OutputAudioPath -Parent) -Force | Out-Null
}

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = 0
$synth.Volume = 100

$voiceFound = $false
foreach ($voice in $synth.GetInstalledVoices()) {
  $name = $voice.VoiceInfo.Name
  if ($name -match 'Helena|Laura|Sabina|Pablo|es-ES|Spanish') {
    try {
      $synth.SelectVoice($name)
      $voiceFound = $true
      break
    } catch {
      # ignore and continue
    }
  }
}

if (-not $voiceFound) {
  Write-Host "No se encontro voz espanola especifica. Se usara la voz por defecto del sistema."
}

$synth.SetOutputToWaveFile($OutputAudioPath)
$synth.Speak($texto)
$synth.Dispose()

Write-Host "Narracion generada en: $OutputAudioPath"
