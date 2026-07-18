# Disattiva la conferma email in Supabase Auth (login subito senza conferma)
# Richiede: Project REF e Personal Access Token (PAT) da Supabase
#
# 1. Project REF: dall'URL del progetto Supabase, es. https://app.supabase.com/project/XXXXX
#    il REF e' la parte "XXXXX" (es. lsuqdeizqapsexeekrua)
# 2. PAT: Supabase Dashboard -> Account (icona utente) -> Access Tokens -> Generate new token
#    Dare al token permesso di lettura/scrittura su Auth (auth_config_write)

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectRef,
    [Parameter(Mandatory=$true)]
    [string]$AccessToken
)

$url = "https://api.supabase.com/v1/projects/$ProjectRef/config/auth"
$body = @{ mailer_autoconfirm = $true } | ConvertTo-Json

Write-Host "Invio PATCH a $url per impostare mailer_autoconfirm = true ..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $url -Method Patch -Headers @{
        "Authorization" = "Bearer $AccessToken"
        "Content-Type"  = "application/json"
    } -Body $body
    Write-Host "OK. Configurazione Auth aggiornata. La conferma email e' ora disattivata." -ForegroundColor Green
} catch {
    Write-Host "Errore: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        Write-Host $reader.ReadToEnd()
    }
    exit 1
}
