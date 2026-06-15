# start.ps1

# Vai pra pasta onde o script está
Set-Location -Path $PSScriptRoot

try {
    $nvmrc = Get-Content ".nvmrc" -ErrorAction Stop
    Write-Host "Usando Node $nvmrc definido em .nvmrc"
    nvm use $nvmrc
} catch {
    Write-Host "Erro ao executar 'nvm use':"
    Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "Abrindo o VS Code..."
Start-Process code .
