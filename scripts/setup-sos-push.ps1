Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Step($message) {
  Write-Host "`n==> $message" -ForegroundColor Cyan
}

function Run($command) {
  Write-Host "   $command" -ForegroundColor DarkGray
  Invoke-Expression $command
}

try {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $projectDir = Split-Path -Parent $scriptDir
  Set-Location -Path $projectDir

  Step 'Validando prerrequisitos'

  if (-not (Test-Path -Path (Join-Path $projectDir 'android\app\google-services.json'))) {
    throw 'Falta android/app/google-services.json. Descargalo desde Firebase Console y copialo en esa ruta antes de continuar.'
  }

  if (-not (Test-Path -Path (Join-Path $projectDir 'supabase\functions\send-sos-push\index.ts'))) {
    throw 'No se encontro la funcion supabase/functions/send-sos-push/index.ts'
  }

  Step 'Configurando credenciales FCM'
  $modeInput = Read-Host 'Modo push [v1/legacy] (Enter = v1)'
  $mode = if ([string]::IsNullOrWhiteSpace($modeInput)) { 'v1' } else { $modeInput.Trim().ToLowerInvariant() }

  if ($mode -eq 'legacy') {
    $secureKey = Read-Host 'Introduce FCM_SERVER_KEY (oculta)' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    try {
      $fcmServerKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }

    if ([string]::IsNullOrWhiteSpace($fcmServerKey)) {
      throw 'FCM_SERVER_KEY vacia. Proceso cancelado.'
    }

    Step 'Guardando FCM_SERVER_KEY en Supabase'
    $env:FCM_SERVER_KEY = $fcmServerKey
    Run 'npx supabase secrets set "FCM_SERVER_KEY=$env:FCM_SERVER_KEY"'
    Remove-Item Env:FCM_SERVER_KEY -ErrorAction SilentlyContinue
  }
  elseif ($mode -eq 'v1') {
    $serviceAccountPath = Read-Host 'Ruta del JSON de cuenta de servicio de Firebase (ej: C:\\Users\\tu\\Downloads\\service-account.json)'
    if ([string]::IsNullOrWhiteSpace($serviceAccountPath) -or -not (Test-Path -Path $serviceAccountPath)) {
      throw 'Ruta JSON de cuenta de servicio no valida.'
    }

    $serviceAccountJson = Get-Content -Path $serviceAccountPath -Raw
    if ([string]::IsNullOrWhiteSpace($serviceAccountJson)) {
      throw 'El JSON de cuenta de servicio esta vacio.'
    }

    # Minificamos para evitar problemas de salto de linea al guardar el secret.
    $serviceAccountMin = ($serviceAccountJson | ConvertFrom-Json | ConvertTo-Json -Compress)
    $env:FCM_SERVICE_ACCOUNT_JSON = $serviceAccountMin

    Step 'Guardando FCM_SERVICE_ACCOUNT_JSON en Supabase'
    Run 'npx supabase secrets set "FCM_SERVICE_ACCOUNT_JSON=$env:FCM_SERVICE_ACCOUNT_JSON"'
    Remove-Item Env:FCM_SERVICE_ACCOUNT_JSON -ErrorAction SilentlyContinue
  }
  else {
    throw 'Modo invalido. Usa v1 o legacy.'
  }

  Step 'Desplegando funcion send-sos-push'
  Run 'npx supabase functions deploy send-sos-push'

  Step 'Verificando migraciones base'
  Run 'npx supabase db push --yes'

  Step 'Compilando web'
  Run 'npm run build'

  Step 'Sincronizando Android (Capacitor)'
  Run 'npx cap sync android'

  Step 'Compilando APK debug'
  Set-Location -Path (Join-Path $projectDir 'android')
  Run '.\gradlew.bat assembleDebug'

  Step 'Resumen final'
  Write-Host 'Listo. SOS push queda configurado y compilado.' -ForegroundColor Green
  Write-Host 'APK debug:' -ForegroundColor Green
  Write-Host (Join-Path $projectDir 'android\app\build\outputs\apk\debug\app-debug.apk') -ForegroundColor Yellow
  Write-Host 'Siguiente paso: probar en 2 moviles (A envia SOS, B recibe con pantalla bloqueada).' -ForegroundColor Green
}
catch {
  Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
