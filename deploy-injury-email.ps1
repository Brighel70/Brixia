# Script: deploy della Edge Function "send-injury-email" su Supabase
# Esegui da PowerShell nella cartella del progetto: .\deploy-injury-email.ps1

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
Set-Location $projectRoot

# 1) Trova il project ref da .env / .env.local (VITE_SUPABASE_URL) o da file salvato
$ref = $null
$envFiles = @(".env", ".env.local", ".env.development")
foreach ($f in $envFiles) {
    $path = Join-Path $projectRoot $f
    if (Test-Path $path) {
        $line = Get-Content $path -Raw | Select-String -Pattern "VITE_SUPABASE_URL=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value.Trim() }
        if ($line -match "https://([a-zA-Z0-9-]+)\.supabase\.co") {
            $ref = $Matches[1]
            break
        }
    }
}
if (-not $ref -and (Test-Path (Join-Path $projectRoot ".supabase-project-ref"))) {
    $ref = (Get-Content (Join-Path $projectRoot ".supabase-project-ref") -Raw).Trim()
}
if (-not $ref) {
    Write-Host ""
    Write-Host "Project ref Supabase non trovato." -ForegroundColor Yellow
    Write-Host "Apri la Dashboard Supabase -> il tuo progetto -> Project Settings -> General."
    Write-Host "Copia il 'Reference ID' (es. abcdefghijklmn)."
    Write-Host ""
    $ref = Read-Host "Incolla qui il Reference ID e premi Invio"
    if ([string]::IsNullOrWhiteSpace($ref)) {
        Write-Host "Operazione annullata." -ForegroundColor Red
        exit 1
    }
    $ref | Set-Content (Join-Path $projectRoot ".supabase-project-ref") -NoNewline
    Write-Host "Reference ID salvato per le prossime volte." -ForegroundColor Green
}

Write-Host ""
Write-Host "Project ref: $ref" -ForegroundColor Cyan
Write-Host ""

# 2) Login (si apre il browser; completa l'accesso se richiesto)
Write-Host "Avvio login Supabase (si aprira il browser)..." -ForegroundColor Cyan
npx supabase login
if ($LASTEXITCODE -ne 0) {
    Write-Host "Login fallito. Riprova." -ForegroundColor Red
    exit 1
}

# 3) Link e deploy: la CLI Supabase legge .env.local e puo' fallire se il file ha caratteri non validi (es. encoding). Lo spostiamo temporaneamente.
$envLocalPath = Join-Path $projectRoot ".env.local"
$envLocalBak = Join-Path $projectRoot ".env.local.bak"
$movedEnv = $false
if (Test-Path $envLocalPath) {
    Move-Item -Path $envLocalPath -Destination $envLocalBak -Force
    $movedEnv = $true
    Write-Host "(File .env.local spostato temporaneamente per evitare errori di parsing della CLI.)" -ForegroundColor Gray
}

try {
    # Link progetto
    Write-Host ""
    Write-Host "Collegamento al progetto Supabase..." -ForegroundColor Cyan
    npx supabase link --project-ref $ref
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Link fallito. Controlla il Reference ID." -ForegroundColor Red
        exit 1
    }

    # 4) Deploy Edge Function
    Write-Host ""
    Write-Host "Deploy della funzione send-injury-email..." -ForegroundColor Cyan
    npx supabase functions deploy send-injury-email
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Deploy fallito." -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "Fatto. La funzione send-injury-email e online." -ForegroundColor Green
    Write-Host "Imposta i segreti RESEND_API_KEY e RESEND_FROM_EMAIL in:" -ForegroundColor Yellow
    Write-Host "  Dashboard Supabase -> Project Settings -> Edge Functions -> Secrets" -ForegroundColor Yellow
    Write-Host ""
} finally {
    if ($movedEnv -and (Test-Path $envLocalBak)) {
        Move-Item -Path $envLocalBak -Destination $envLocalPath -Force
        Write-Host ".env.local ripristinato." -ForegroundColor Gray
    }
}
