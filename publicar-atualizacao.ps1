$ErrorActionPreference = "Stop"

Write-Host "Movyo Desktop - publicação segura de atualização" -ForegroundColor Cyan

$secureToken = Read-Host "Cole o token do GitHub (a entrada ficará oculta)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if ([string]::IsNullOrWhiteSpace($token)) {
        throw "Token não informado."
    }

    $env:GH_TOKEN = $token

    Write-Host "Validando acesso ao repositório MovyoTech/Movyo-Desktop..." -ForegroundColor Yellow
    $headers = @{
        Authorization = "Bearer $token"
        Accept = "application/vnd.github+json"
        "X-GitHub-Api-Version" = "2022-11-28"
        "User-Agent" = "Movyo-Desktop-Publisher"
    }

    Invoke-RestMethod `
        -Uri "https://api.github.com/repos/MovyoTech/Movyo-Desktop" `
        -Headers $headers `
        -Method Get | Out-Null

    Write-Host "Token validado. Gerando e publicando a versão..." -ForegroundColor Green
    npm run dist:publish

    if ($LASTEXITCODE -ne 0) {
        throw "A publicação terminou com código $LASTEXITCODE."
    }

    Write-Host "Atualização publicada com sucesso." -ForegroundColor Green
}
finally {
    Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    $token = $null
}
