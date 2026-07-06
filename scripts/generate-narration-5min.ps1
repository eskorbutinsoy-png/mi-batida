Param(
  [string]$InputTextPath = "./docs/video/narracion-video-5min.txt",
  [string]$OutputAudioPath = "./docs/video/narracion-video-5min.wav"
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

New-Item -ItemType Directory -Path (Split-Path -Path $OutputAudioPath -Parent) -Force | Out-Null

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = -1
$synth.Volume = 100

$selected = $false
$preferred = @('Helena', 'Sabina', 'Laura', 'Pablo', 'Microsoft Helena Desktop', 'Microsoft Sabina Desktop', 'Microsoft Laura Desktop', 'Microsoft Pablo Desktop')
foreach ($candidate in $preferred) {
  try {
    $synth.SelectVoice($candidate)
    $selected = $true
    break
  } catch {
    # continue
  }
}

if (-not $selected) {
  foreach ($voice in $synth.GetInstalledVoices()) {
    $name = $voice.VoiceInfo.Name
    if ($name -match 'Helena|Sabina|Laura|Pablo|es-ES|Spanish') {
      try {
        $synth.SelectVoice($name)
        $selected = $true
        break
      } catch {
        # ignore
      }
    }
  }
}

$synth.SetOutputToWaveFile($OutputAudioPath)
$synth.Speak($texto)
$synth.Dispose()

Write-Host "Narracion generada en: $OutputAudioPath"
