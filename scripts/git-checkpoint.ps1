param(
  [string]$Message = "chore: local checkpoint",
  [switch]$CreateTag
)

$ErrorActionPreference = "Stop"

function Get-GitCommand {
  $gitCommand = Get-Command git -ErrorAction SilentlyContinue

  if ($gitCommand) {
    return $gitCommand.Source
  }

  $fallback = "C:\Program Files\Git\cmd\git.exe"
  if (Test-Path $fallback) {
    return $fallback
  }

  throw "Git nao encontrado nesta maquina."
}

function Invoke-Git {
  param(
    [string]$GitPath,
    [string[]]$Args
  )

  & $GitPath @Args
}

$git = Get-GitCommand
$repoRoot = Invoke-Git -GitPath $git -Args @("rev-parse", "--show-toplevel") 2>$null

if (-not $repoRoot) {
  throw "Este diretorio nao esta dentro de um repositorio Git."
}

$repoRoot = $repoRoot.Trim()
Push-Location $repoRoot

try {
  New-Item -ItemType Directory -Force -Path "backups" | Out-Null

  Invoke-Git -GitPath $git -Args @("add", ".")

  $status = Invoke-Git -GitPath $git -Args @("status", "--short")
  if (-not $status) {
    Write-Host "Nenhuma alteracao pendente para salvar."
    exit 0
  }

  Invoke-Git -GitPath $git -Args @("commit", "-m", $Message)

  $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
  $bundlePath = Join-Path $repoRoot "backups\safisa-$timestamp.bundle"
  Invoke-Git -GitPath $git -Args @("bundle", "create", $bundlePath, "--all")

  if ($CreateTag) {
    $tagName = "checkpoint-$timestamp"
    Invoke-Git -GitPath $git -Args @("tag", $tagName)
    Write-Host "Tag criada: $tagName"
  }

  Write-Host "Checkpoint salvo com sucesso."
  Write-Host "Backup local: $bundlePath"
} finally {
  Pop-Location
}
