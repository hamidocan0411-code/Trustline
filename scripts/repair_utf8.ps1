$ErrorActionPreference = 'Stop'

# TrustLine Express - UTF-8 / mojibake repair
# ASCII-only script so PowerShell parser cannot be broken by encoding issues.

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $root ("backup-utf8-" + $timestamp)
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$extensions = @('.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.md','.html','.css','.scss','.yml','.yaml','.rules','.txt')
$specialNames = @('.env.example','.firebaserc','firebase.json')

[System.Text.Encoding]::RegisterProvider([System.Text.CodePagesEncodingProvider]::Instance)
$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
$cp1254 = [System.Text.Encoding]::GetEncoding(1254)
$cp1252 = [System.Text.Encoding]::GetEncoding(1252)

function Test-Excluded([string]$fullName) {
    $n = $fullName.Replace('/','\')
    $r = $root.Replace('/','\').TrimEnd('\')
    $prefixes = @(
        ($r + '\.git\'),
        ($r + '\node_modules\'),
        ($r + '\dist\'),
        ($r + '\.firebase\'),
        ($r + '\backup-utf8-')
    )
    foreach ($prefix in $prefixes) {
        if ($n.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
    return $false
}

function Get-MojibakeScore([string]$value) {
    if ([string]::IsNullOrEmpty($value)) { return 0 }
    $score = 0
    foreach ($ch in $value.ToCharArray()) {
        $code = [int][char]$ch
        switch ($code) {
            194 { $score += 1 }
            195 { $score += 1 }
            196 { $score += 1 }
            197 { $score += 1 }
            226 { $score += 1 }
            239 { $score += 1 }
            240 { $score += 1 }
            128 { $score += 3 }
            129 { $score += 3 }
            130 { $score += 3 }
            131 { $score += 3 }
            132 { $score += 3 }
            133 { $score += 3 }
            134 { $score += 3 }
            135 { $score += 3 }
            136 { $score += 3 }
            137 { $score += 3 }
            138 { $score += 3 }
            139 { $score += 3 }
            140 { $score += 3 }
            141 { $score += 3 }
            142 { $score += 3 }
            143 { $score += 3 }
            144 { $score += 3 }
            145 { $score += 3 }
            146 { $score += 3 }
            147 { $score += 3 }
            148 { $score += 3 }
            149 { $score += 3 }
            150 { $score += 3 }
            151 { $score += 3 }
            152 { $score += 3 }
            153 { $score += 3 }
            154 { $score += 3 }
            155 { $score += 3 }
            156 { $score += 3 }
            157 { $score += 3 }
            158 { $score += 3 }
            159 { $score += 3 }
        }
    }
    return $score
}

function Try-RepairText([string]$text) {
    $best = $text
    $bestScore = Get-MojibakeScore $text
    if ($bestScore -eq 0) { return $text }

    for ($pass = 0; $pass -lt 3; $pass++) {
        $changed = $false
        foreach ($encoding in @($cp1254, $cp1252)) {
            try {
                $bytes = $encoding.GetBytes($best)
                $candidate = $utf8.GetString($bytes)
                if ($candidate.Contains([char]0xFFFD)) { continue }
                $score = Get-MojibakeScore $candidate
                if ($score -lt $bestScore) {
                    $best = $candidate
                    $bestScore = $score
                    $changed = $true
                }
            } catch {
                continue
            }
        }
        if (-not $changed) { break }
    }

    return $best
}

$files = Get-ChildItem -Path $root -Recurse -File | Where-Object {
    if (Test-Excluded $_.FullName) { return $false }
    return ($extensions -contains $_.Extension.ToLowerInvariant()) -or ($specialNames -contains $_.Name)
}

$changed = New-Object System.Collections.Generic.List[string]

foreach ($file in $files) {
    try {
        $raw = [System.IO.File]::ReadAllBytes($file.FullName)
        $text = $utf8.GetString($raw)
        $withoutBom = $text.TrimStart([char]0xFEFF)
        $fixed = Try-RepairText $withoutBom

        if ($fixed -ne $withoutBom -or $text.StartsWith([char]0xFEFF)) {
            $relative = $file.FullName.Substring($root.Length).TrimStart('\','/')
            $backupPath = Join-Path $backupRoot $relative
            $backupDir = Split-Path $backupPath -Parent
            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
            Copy-Item $file.FullName $backupPath -Force
            [System.IO.File]::WriteAllText($file.FullName, $fixed, $utf8)
            $changed.Add($relative)
            Write-Host ("FIXED: " + $relative) -ForegroundColor Green
        }
    } catch {
        Write-Warning ("SKIPPED: " + $file.FullName + " -> " + $_.Exception.Message)
    }
}

$appPath = Join-Path $root 'src\App.tsx'
if (Test-Path $appPath) {
    $s = [System.IO.File]::ReadAllText($appPath, $utf8)
    $old = $s
    $s = $s.Replace('perKmPrice: 20,','perKmPrice: 36,')
    $s = $s.Replace('minPrice: 100,','minPrice: 250,')
    $s = $s.Replace('urgentMultiplier: 1.5,','urgentMultiplier: 1.3,')
    $s = $s.Replace('vipMultiplier: 2,','vipMultiplier: 1.6,')
    if ($s -ne $old) {
        $relative = 'src\App.tsx'
        $backupPath = Join-Path $backupRoot $relative
        $backupDir = Split-Path $backupPath -Parent
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        if (-not (Test-Path $backupPath)) { Copy-Item $appPath $backupPath -Force }
        [System.IO.File]::WriteAllText($appPath,$s,$utf8)
        if (-not $changed.Contains($relative)) { $changed.Add($relative) }
        Write-Host ("PRICE FALLBACK FIXED: " + $relative) -ForegroundColor Green
    }
}

$homePath = Join-Path $root 'src\components\CustomerHome.tsx'
if (Test-Path $homePath) {
    $s = [System.IO.File]::ReadAllText($homePath, $utf8)
    $old = $s
    $s = $s.Replace('pricing?.perKmPrice ?? 50','pricing?.perKmPrice ?? 36')
    if ($s -ne $old) {
        $relative = 'src\components\CustomerHome.tsx'
        $backupPath = Join-Path $backupRoot $relative
        $backupDir = Split-Path $backupPath -Parent
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        if (-not (Test-Path $backupPath)) { Copy-Item $homePath $backupPath -Force }
        [System.IO.File]::WriteAllText($homePath,$s,$utf8)
        if (-not $changed.Contains($relative)) { $changed.Add($relative) }
        Write-Host ("PRICE FALLBACK FIXED: " + $relative) -ForegroundColor Green
    }
}

Write-Host ''
Write-Host ("TOTAL FIXED FILES: " + $changed.Count) -ForegroundColor Cyan
Write-Host ("BACKUP: " + $backupRoot) -ForegroundColor DarkGray

$remaining = @()
foreach ($file in $files) {
    try {
        $raw = [System.IO.File]::ReadAllBytes($file.FullName)
        $text = $utf8.GetString($raw).TrimStart([char]0xFEFF)
        if ((Get-MojibakeScore $text) -gt 0) { $remaining += $file.FullName }
    } catch {}
}

if ($remaining.Count -gt 0) {
    Write-Warning ("MOJIBAKE CHECK FAILED. FILES: " + $remaining.Count)
    $remaining | ForEach-Object { Write-Host ("  " + $_) -ForegroundColor Yellow }
    throw 'Mojibake remains in repository.'
}

Write-Host 'MOJIBAKE CHECK: CLEAN' -ForegroundColor Green
Write-Host ''
Write-Host 'Running npm run build...' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }

Write-Host ''
Write-Host 'DONE. UTF-8 repair completed and build succeeded.' -ForegroundColor Green
