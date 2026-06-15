$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()

Write-Host "Movyo Desktop - publicação segura de atualização" -ForegroundColor Cyan

$package = Get-Content -Raw -Path ".\package.json" | ConvertFrom-Json
$version = [string]$package.version
$repoOwner = [string]$package.build.publish[0].owner
$repoName = [string]$package.build.publish[0].repo
$releaseType = [string]$package.build.publish[0].releaseType
$isPrivate = [bool]$package.build.publish[0].private

if ([string]::IsNullOrWhiteSpace($version)) {
    throw "Não foi possível identificar a versão no package.json."
}

if ($repoOwner -ne "Heliow9" -or $repoName -ne "movyodektop") {
    throw "Repositório de publicação incorreto: $repoOwner/$repoName. Esperado: Heliow9/movyodektop."
}

if ($isPrivate) {
    throw "O repositório Heliow9/movyodektop é público. Altere build.publish.private para false."
}

if ($releaseType -ne "release") {
    throw "Configure build.publish.releaseType como 'release' para publicar a versão automaticamente."
}

Write-Host "Versão: $version" -ForegroundColor Gray
Write-Host "Destino: https://github.com/$repoOwner/$repoName/releases" -ForegroundColor Gray

$secureToken = Read-Host "Cole o token do GitHub (a entrada ficará oculta)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if ([string]::IsNullOrWhiteSpace($token)) {
        throw "Token não informado."
    }

    $env:GH_TOKEN = $token

    Write-Host "Validando acesso ao repositório $repoOwner/$repoName..." -ForegroundColor Yellow
    $headers = @{
        Authorization = "Bearer $token"
        Accept = "application/vnd.github+json"
        "X-GitHub-Api-Version" = "2022-11-28"
        "User-Agent" = "MovyoDesktop-Publisher"
    }

    $repo = Invoke-RestMethod `
        -Uri "https://api.github.com/repos/$repoOwner/$repoName" `
        -Headers $headers `
        -Method Get

    if (-not $repo.permissions.push) {
        throw "O token não possui permissão de escrita no repositório."
    }

    Write-Host "Token validado. Gerando e publicando a versão $version..." -ForegroundColor Green
    npm run dist:publish

    if ($LASTEXITCODE -ne 0) {
        throw "A publicação terminou com código $LASTEXITCODE."
    }

    Write-Host "Validando a release pública v$version..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3

    $release = Invoke-RestMethod `
        -Uri "https://api.github.com/repos/$repoOwner/$repoName/releases/tags/v$version" `
        -Headers @{ Accept = "application/vnd.github+json"; "User-Agent" = "MovyoDesktop-Publisher" } `
        -Method Get

    if ($release.draft) {
        throw "A release v$version ainda está como rascunho. Publique-a no GitHub ou mantenha releaseType='release'."
    }

    if ($release.prerelease) {
        throw "A release v$version foi publicada como pré-lançamento e não será usada pelo canal estável."
    }

    $assetNames = @($release.assets | ForEach-Object { $_.name })
    $requiredAssets = @(
        "latest.yml",
        "Movyo-Food-Setup-$version.exe",
        "Movyo-Food-Setup-$version.exe.blockmap"
    )

    $missing = @($requiredAssets | Where-Object { $_ -notin $assetNames })
    if ($missing.Count -gt 0) {
        throw "Release publicada, mas faltam arquivos obrigatórios: $($missing -join ', ')"
    }

    Write-Host "Atualização publicada e validada com sucesso." -ForegroundColor Green
    Write-Host "Release pública: $($release.html_url)" -ForegroundColor Cyan
    Write-Host "Arquivos encontrados: $($requiredAssets -join ', ')" -ForegroundColor Gray
}
finally {
    Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    $token = $null
}
