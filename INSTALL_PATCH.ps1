param(
    [string]$Frontend = 'D:\new another projectA\frontend'
)
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'src'
$targetSrc = Join-Path $Frontend 'src'
if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    throw "Folder patch 'src' tidak ditemukan di: $source"
}
if (-not (Test-Path -LiteralPath (Join-Path $Frontend 'package.json') -PathType Leaf)) {
    throw "Folder frontend React tidak ditemukan: $Frontend"
}
if (-not (Test-Path -LiteralPath $targetSrc -PathType Container)) {
    throw "Folder src frontend tidak ditemukan: $targetSrc"
}
$root = Split-Path $Frontend -Parent
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backup = Join-Path $root "src_backup_before_v2_1d_$stamp"
Write-Host "Membuat backup: $backup"
Copy-Item -LiteralPath $targetSrc -Destination $backup -Recurse
$count = 0
Get-ChildItem -LiteralPath $source -File -Recurse | ForEach-Object {
    $relative = $_.FullName.Substring($source.Length).TrimStart('\', '/')
    $destination = Join-Path $targetSrc $relative
    $parent = Split-Path $destination -Parent
    New-Item -Path $parent -ItemType Directory -Force | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
    $count++
}
Write-Host "Selesai: $count file dipasang ke $targetSrc"
Write-Host "Backup tetap ada di: $backup"
Write-Host "Langkah berikutnya: cd '$Frontend'; npm run build; npm run dev"
