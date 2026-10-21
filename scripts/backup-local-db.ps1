# Read-only logical backup of the local MySQL database. Does not modify the database.
# Password comes from $env:LOCAL_DB_PASSWORD, or from backend\.env (DB_PASSWORD / MYSQL_PASSWORD) -- never printed.
param(
  [string]$MysqlBin = "",
  [string]$OutDir = (Join-Path $PSScriptRoot "..\backups")
)
$ErrorActionPreference = "Stop"

function Read-EnvFile($path) {
  $map = @{}
  if (Test-Path $path) {
    foreach ($line in Get-Content $path) {
      if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { $map[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'") }
    }
  }
  $map
}
$envFile = Read-EnvFile (Join-Path $PSScriptRoot "..\backend\.env")
function Pick($names) { foreach ($n in $names) { if ($envFile[$n]) { return $envFile[$n] } }; return $null }

$dbHost = Pick @("DB_HOST", "MYSQL_HOST"); if (-not $dbHost) { $dbHost = "127.0.0.1" }
$dbPort = Pick @("DB_PORT", "MYSQL_PORT"); if (-not $dbPort) { $dbPort = "3306" }
$dbName = Pick @("DB_NAME", "MYSQL_DATABASE"); if (-not $dbName) { $dbName = "art" }
$dbUser = Pick @("DB_USER", "MYSQL_USER"); if (-not $dbUser) { $dbUser = "root" }
$dbPass = $env:LOCAL_DB_PASSWORD; if (-not $dbPass) { $dbPass = Pick @("DB_PASSWORD", "MYSQL_PASSWORD") }

if (-not $MysqlBin) { $MysqlBin = Split-Path (Get-Command mysqldump).Source }
$dump = Join-Path $MysqlBin "mysqldump.exe"

New-Item -ItemType Directory -Force $OutDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$file = Join-Path $OutDir "${dbName}_$stamp.sql"

# Credentials go through a temporary option file so they never appear in the process list or logs.
$cnf = New-TemporaryFile
try {
  Set-Content -Path $cnf -Value "[client]`nuser=$dbUser`npassword=`"$dbPass`"`nhost=$dbHost`nport=$dbPort"
  & $dump "--defaults-extra-file=$cnf" --single-transaction --routines --triggers --events --hex-blob `
    --default-character-set=utf8mb4 --set-gtid-purged=OFF --no-tablespaces --result-file="$file" $dbName
  if ($LASTEXITCODE -ne 0) { throw "mysqldump failed (exit $LASTEXITCODE)" }
} finally { Remove-Item $cnf -Force -ErrorAction SilentlyContinue }

$item = Get-Item $file
"Backup: $($item.FullName)"
"Size:   $($item.Length) bytes"
"SHA256: $((Get-FileHash $file -Algorithm SHA256).Hash)"
