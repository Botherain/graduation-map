# build.ps1 - Assemble single-file CengFanTu.html (ASCII-only script)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $root 'src'
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
Get-ChildItem -Path $dist -Filter '*.html' -ErrorAction SilentlyContinue | Remove-Item -Force

function Read-Utf8([string]$p) {
  return [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
}

$html = Read-Utf8 (Join-Path $src 'index.html')

$map = @{
  '{{STYLE}}'   = Join-Path $src 'style.css'
  '{{ECHARTS}}' = Join-Path $root 'vendor\echarts.min.js'
  '{{XLSX}}'    = Join-Path $root 'vendor\xlsx.full.min.js'
  '{{H2C}}'     = Join-Path $root 'vendor\html2canvas.min.js'
  '{{JSPDF}}'   = Join-Path $root 'vendor\jspdf.umd.min.js'
  '{{GEO}}'     = Join-Path $src 'geo\china_full.json'
  '{{JS_DATA}}'  = Join-Path $src 'js\01-data.js'
  '{{JS_MODEL}}' = Join-Path $src 'js\02-model.js'
  '{{JS_EXCEL}}' = Join-Path $src 'js\03-excel.js'
  '{{JS_MAP}}'   = Join-Path $src 'js\04-map.js'
  '{{JS_RENDER}}'= Join-Path $src 'js\05-render.js'
  '{{JS_EDITOR}}'= Join-Path $src 'js\06-editor.js'
  '{{JS_IO}}'    = Join-Path $src 'js\07-io.js'
}

foreach ($k in $map.Keys) {
  $p = $map[$k]
  if (-not (Test-Path $p)) { throw "missing file: $p" }
  $content = Read-Utf8 $p
  if ($content -match '(?i)</script') { Write-Warning "WARN: $p contains '</script' - may break inline embedding" }
  $html = $html.Replace($k, $content)
}

# sanity: no unreplaced placeholders
$left = [regex]::Matches($html, '\{\{[A-Z_]+\}\}')
if ($left.Count -gt 0) {
  $names = ($left | ForEach-Object { $_.Value }) -join ','
  throw "unreplaced placeholders: $names"
}

$outName = ([char]0x8E6D).ToString() + ([char]0x996D) + ([char]0x56FE) + '.html'
$out = Join-Path $dist $outName
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($out, $html, $utf8NoBom)
Write-Output ("built: " + $out + "  " + (Get-Item $out).Length + " bytes")
