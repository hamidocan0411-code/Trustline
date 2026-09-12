$ErrorActionPreference = 'Stop'

# TrustLine Express - Turkish UTF-8 / mojibake repair
# Scans the repository, creates a timestamped backup, repairs broken UTF-8 text,
# removes UTF-8 BOMs, fixes known pricing fallbacks, then builds the project.

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $root "backup-utf8-$timestamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$extensions = @('.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.md','.html','.css','.scss','.yml','.yaml','.rules','.txt')
$specialNames = @('.env.example','.firebaserc','firebase.json')
$excluded = @('.git','node_modules','dist','.firebase','backup-utf8-')

[System.Text.Encoding]::RegisterProvider([System.Text.CodePagesEncodingProvider]::Instance)
$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
$cp1254 = [System.Text.Encoding]::GetEncoding(1254)
$cp1252 = [System.Text.Encoding]::GetEncoding(1252)

function Test-Excluded([string]$fullName) {
    foreach ($part in $excluded) {
        if ($fullName -match [regex]::Escape("\$part\")) { return $true }
    }
    return $false
}

function Get-MojibakeScore([string]$value) {
    if ([string]::IsNullOrEmpty($value)) { return 0 }
    $matches = [regex]::Matches($value, '[ÃÄÅÂâğðï]|[\u0080-\u009F]')
    return $matches.Count
}

function Try-RepairToken([string]$token) {
    $scoreBefore = Get-MojibakeScore $token
    if ($scoreBefore -eq 0) { return $token }

    $best = $token
    $bestScore = $scoreBefore

    foreach ($encoding in @($cp1254,$cp1252)) {
        try {
            $bytes = $encoding.GetBytes($token)
            $candidate = $utf8.GetString($bytes)
            if ($candidate.Contains([char]0xFFFD)) { continue }
            $score = Get-MojibakeScore $candidate
            if ($score -lt $bestScore) {
                $best = $candidate
                $bestScore = $score
            }
        } catch {
            continue
        }
    }

    return $best
}

function Repair-Line([string]$line) {
    $current = $line

    for ($pass = 0; $pass -lt 3; $pass++) {
        if (Get-MojibakeScore $current -eq 0) { break }

        $current = [regex]::Replace($current, '\S+', {
            param($match)
            Try-RepairToken $match.Value
        })
    }

    return $current
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

        $fixedLines = New-Object System.Collections.Generic.List[string]
        foreach ($line in ($text -split "`r?`n", -1)) {
            $fixedLines.Add((Repair-Line $line))
        }

        $fixed = [string]::Join("`n", $fixedLines)
        $fixed = $fixed.TrimStart([char]0xFEFF)

        if ($fixed -ne $text.TrimStart([char]0xFEFF)) {
            $relative = $file.FullName.Substring($root.Length).TrimStart('\','/')
            $backupPath = Join-Path $backupRoot $relative
            $backupDir = Split-Path $backupPath -Parent
            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
            Copy-Item $file.FullName $backupPath -Force

            [System.IO.File]::WriteAllText($file.FullName, $fixed, $utf8)
            $changed.Add($relative)
            Write-Host "UTF-8 DÜZELTİLDİ: $relative" -ForegroundColor Green
        }
    } catch {
        Write-Warning "Dosya atlandı: $($file.FullName) -> $($_.Exception.Message)"
    }
}

# Known TrustLine V1 pricing fallbacks.
$appPath = Join-Path $root 'src\App.tsx'
if (Test-Path $appPath) {
    $s = [System.IO.File]::ReadAllText($appPath, $utf8)
    $old = $s
    $s = $s.Replace('perKmPrice: 20,','perKmPrice: 36,')
    $s = $s.Replace('minPrice: 100,','minPrice: 250,')
    $s = $s.Replace('urgentMultiplier: 1.5,','urgentMultiplier: 1.3,')
    $s = $s.Replace('vipMultiplier: 2,','vipMultiplier: 1.6,')
    if ($s -ne $old) {
        Copy-Item $appPath (Join-Path $backupRoot 'src\App.tsx') -Force
        [System.IO.File]::WriteAllText($appPath,$s,$utf8)
        if (-not $changed.Contains('src\App.tsx')) { $changed.Add('src\App.tsx') }
        Write-Host 'FİYAT FALLBACK: src\App.tsx' -ForegroundColor Green
    }
}

$homePath = Join-Path $root 'src\components\CustomerHome.tsx'
if (Test-Path $homePath) {
    $s = [System.IO.File]::ReadAllText($homePath, $utf8)
    $old = $s
    $s = $s.Replace('pricing?.perKmPrice ?? 50','pricing?.perKmPrice ?? 36')
    if ($s -ne $old) {
        Copy-Item $homePath (Join-Path $backupRoot 'src\components\CustomerHome.tsx') -Force
        [System.IO.File]::WriteAllText($homePath,$s,$utf8)
        if (-not $changed.Contains('src\components\CustomerHome.tsx')) { $changed.Add('src\components\CustomerHome.tsx') }
        Write-Host 'FİYAT FALLBACK: src\components\CustomerHome.tsx' -ForegroundColor Green
    }
}

Write-Host ''
Write-Host ('TOPLAM DÜZELTİLEN DOSYA: ' + $changed.Count) -ForegroundColor Cyan
Write-Host ('YEDEK: ' + $backupRoot) -ForegroundColor DarkGray

$remaining = Get-ChildItem -Path $root -Recurse -File | Where-Object {
    if (Test-Excluded $_.FullName) { return $false }
    return ($extensions -contains $_.Extension.ToLowerInvariant()) -or ($specialNames -contains $_.Name)
} | Select-String -Pattern 'Ã|Ä|Å|Â|â|ğŸ|ðŸ|ï¸|[\u0080-\u009F]' -SimpleMatch:$false -AllMatches -ErrorAction SilentlyContinue

if ($remaining) {
    Write-Warning 'Hâlâ mojibake izi bulunan dosyalar var. Yukarıdaki listeyi kontrol edin.'
} else {
    Write-Host 'MOJIBAKE KONTROLÜ: TEMİZ' -ForegroundColor Green
}

Write-Host ''
Write-Host 'Şimdi npm run build çalıştırılıyor...' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    throw 'Build başarısız oldu.'
}

Write-Host ''
Write-Host 'TAMAMLANDI. Türkçe metinler UTF-8 olarak düzeltildi ve build başarılı.' -ForegroundColor Green
