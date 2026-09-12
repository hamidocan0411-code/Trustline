$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $root "backup-utf8-$timestamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$extensions = @('.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.md','.html','.css','.scss','.yml','.yaml','.rules','.txt')
$specialNames = @('.env.example','.firebaserc','firebase.json')
$excludedNames = @('.git','node_modules','dist','.firebase')

[System.Text.Encoding]::RegisterProvider([System.Text.CodePagesEncodingProvider]::Instance)
$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
$cp1254 = [System.Text.Encoding]::GetEncoding(1254)
$cp1252 = [System.Text.Encoding]::GetEncoding(1252)

function Test-Excluded([string]$fullName) {
    $normalized = $fullName.Replace('/','\')
    $rootNormalized = $root.Replace('/','\').TrimEnd('\')

    foreach ($name in $excludedNames) {
        $prefix = $rootNormalized + '\' + $name + '\'
        if ($normalized.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }

    return $false
}

function Get-MojibakeScore([string]$value) {
    if ([string]::IsNullOrEmpty($value)) {
        return 0
    }

    $score = 0
    foreach ($ch in $value.ToCharArray()) {
        $code = [int][char]$ch
        if (($code -eq 0x00C3) -or ($code -eq 0x00C4) -or ($code -eq 0x00C5) -or ($code -eq 0x00C2) -or ($code -eq 0x00E2) -or ($code -eq 0x00D0) -or ($code -eq 0x00CF) -or ($code -ge 0x0080 -and $code -le 0x009F)) {
            $score++
        }
    }

    return $score
}

function Try-RepairToken([string]$token) {
    $scoreBefore = Get-MojibakeScore $token
    if ($scoreBefore -eq 0) {
        return $token
    }

    $best = $token
    $bestScore = $scoreBefore

    foreach ($encoding in @($cp1254,$cp1252)) {
        try {
            $bytes = $encoding.GetBytes($token)
            $candidate = $utf8.GetString($bytes)

            if ($candidate.Contains([char]0xFFFD)) {
                continue
            }

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
        if ((Get-MojibakeScore $current) -eq 0) {
            break
        }

        $current = [regex]::Replace($current, '\S+', {
            param($match)
            Try-RepairToken $match.Value
        })
    }

    return $current
}

$files = Get-ChildItem -Path $root -Recurse -File | Where-Object {
    if (Test-Excluded $_.FullName) {
        return $false
    }

    return (($extensions -contains $_.Extension.ToLowerInvariant()) -or ($specialNames -contains $_.Name))
}

$changed = New-Object System.Collections.Generic.List[string]

foreach ($file in $files) {
    try {
        $raw = [System.IO.File]::ReadAllBytes($file.FullName)
        $text = $utf8.GetString($raw)
        $original = $text.TrimStart([char]0xFEFF)

        $fixedLines = New-Object System.Collections.Generic.List[string]
        foreach ($line in ($original -split "`r?`n", -1)) {
            $fixedLines.Add((Repair-Line $line))
        }

        $fixed = [string]::Join("`n", $fixedLines)
        $relative = $file.FullName.Substring($root.Length).TrimStart('\','/')

        if ($fixed -ne $original -or $text.StartsWith([char]0xFEFF)) {
            $backupPath = Join-Path $backupRoot $relative
            $backupDir = Split-Path $backupPath -Parent
            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
            Copy-Item $file.FullName $backupPath -Force

            [System.IO.File]::WriteAllText($file.FullName, $fixed, $utf8)
            $changed.Add($relative)
            Write-Host "FIXED: $relative" -ForegroundColor Green
        }
    } catch {
        Write-Warning "SKIPPED: $($file.FullName) -> $($_.Exception.Message)"
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
        $relative = 'src\App.tsx'
        $backupPath = Join-Path $backupRoot $relative
        $backupDir = Split-Path $backupPath -Parent
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        if (-not (Test-Path $backupPath)) {
            Copy-Item $appPath $backupPath -Force
        }
        [System.IO.File]::WriteAllText($appPath,$s,$utf8)
        if (-not $changed.Contains($relative)) {
            $changed.Add($relative)
        }
        Write-Host 'PRICE FALLBACK FIXED: src\App.tsx' -ForegroundColor Green
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
        if (-not (Test-Path $backupPath)) {
            Copy-Item $homePath $backupPath -Force
        }
        [System.IO.File]::WriteAllText($homePath,$s,$utf8)
        if (-not $changed.Contains($relative)) {
            $changed.Add($relative)
        }
        Write-Host 'PRICE FALLBACK FIXED: src\components\CustomerHome.tsx' -ForegroundColor Green
    }
}

Write-Host ''
Write-Host ('FILES FIXED: ' + $changed.Count) -ForegroundColor Cyan
Write-Host ('BACKUP: ' + $backupRoot) -ForegroundColor DarkGray

$remaining = Get-ChildItem -Path $root -Recurse -File | Where-Object {
    if (Test-Excluded $_.FullName) {
        return $false
    }
    return (($extensions -contains $_.Extension.ToLowerInvariant()) -or ($specialNames -contains $_.Name))
} | Select-String -Pattern 'Ã|Ä|Å|Â|â|ð|ï' -AllMatches -ErrorAction SilentlyContinue

if ($remaining) {
    Write-Warning 'Mojibake traces still exist in some files. Review the listed files.'
} else {
    Write-Host 'MOJIBAKE CHECK: CLEAN' -ForegroundColor Green
}

Write-Host ''
Write-Host 'Running npm run build...' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    throw 'Build failed.'
}

Write-Host ''
Write-Host 'DONE. Turkish text repair completed and build succeeded.' -ForegroundColor Green
