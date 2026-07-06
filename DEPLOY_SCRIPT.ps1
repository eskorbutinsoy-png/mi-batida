# Script para hacer deploy a Vercel
# Este archivo contiene los comandos necesarios

# ============================================
# PASO 1: Crear repositorio en GitHub
# ============================================
# 1. Abre https://github.com/new
# 2. Nombre del repo: "mi-batida" (o el que quieras)
# 3. NO inicialices con README (dejar vacío)
# 4. Copia el HTTPS URL (ej: https://github.com/tuusuario/mi-batida.git)
# 5. Pega la URL en la línea de abajo:

$GITHUB_URL = "PEGA_TU_GITHUB_URL_AQUI"

# ============================================
# PASO 2: Hacer push a GitHub
# ============================================
# Descomenta las líneas de abajo y ejecuta

# cd c:\pruebasinbolt\project
# & "C:\Program Files\Git\bin\git.exe" branch -M main
# & "C:\Program Files\Git\bin\git.exe" remote add origin $GITHUB_URL
# & "C:\Program Files\Git\bin\git.exe" push -u origin main

# ============================================
# PASO 3: Verificar push
# ============================================
# Abre https://github.com/tuusuario/mi-batida
# Deberías ver todos los archivos aquí

# ============================================
# PASO 4: Deploy en Vercel
# ============================================
# 1. Abre https://vercel.com/new
# 2. Conecta GitHub
# 3. Selecciona "mi-batida"
# 4. En "Environment Variables" agrega:
#    - VITE_SUPABASE_URL = https://abdwszaejrzqtjlvhakw.supabase.co
#    - VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZHdzemFlanJ6cXRqbHZoYWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDQwOTIsImV4cCI6MjA5ODUyMDA5Mn0.dFp-K59inlYrdCRa4hC9EP5ukMJIviaiLilzchf6l8c
# 5. Haz clic en "Deploy"
# 6. Espera 2-3 minutos
# 7. ¡Listo! Vercel te da la URL pública

Write-Host "
╔════════════════════════════════════════════════════════════════╗
║  MI BATIDA - DEPLOYMENT CHECKLIST                             ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  ✅ Código compilado y preparado                              ║
║  ✅ Git inicializado y primer commit hecho                    ║
║  ⏳ Paso 1: Crear repositorio en GitHub                       ║
║  ⏳ Paso 2: Hacer push (comando abajo)                        ║
║  ⏳ Paso 3: Configurar Vercel                                 ║
║  ⏳ ✨ Obtener URL pública y compartir                        ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
" -ForegroundColor Cyan
