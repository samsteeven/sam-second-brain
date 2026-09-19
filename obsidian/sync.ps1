# Sync Second Brain — envoie les notes Obsidian vers le workflow n8n d'ingestion
# Usage :  powershell -File sync.ps1
# Option : powershell -File sync.ps1 -VaultDir "D:\Documents\sam-second-brain-vault"

param(
  [string]$VaultDir = "D:\Documents\sam-second-brain-vault",
  [string]$WebhookUrl = "https://n8n.samensteeve.com/webhook/second-brain/ingest"
)

$files = Get-ChildItem -Path $VaultDir -Recurse -Filter *.md -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "\.obsidian|\.trash|\\templates\\" }

if (-not $files) {
  Write-Host "Aucune note trouvee dans $VaultDir"
  exit 1
}

$items = foreach ($f in $files) {
  $content = Get-Content $f.FullName -Raw -Encoding UTF8
  $category = "knowledge"
  $tags = ""
  $status = ""

  # Extraire le frontmatter YAML (type, tags, status)
  if ($content -match "(?s)^---\r?\n(.*?)\r?\n---") {
    $fm = $Matches[1]
    if ($fm -match "(?m)^type:\s*([\w-]+)") { $category = $Matches[1] }
    if ($fm -match "(?m)^tags:\s*\[(.*?)\]")  { $tags = $Matches[1] }
    if ($fm -match "(?m)^status:\s*([\w-]+)") { $status = $Matches[1] }
  }

  $rel = $f.FullName.Substring($VaultDir.Length + 1).Replace('\', '/')

  [PSCustomObject]@{
    text     = $content
    file     = $rel
    category = $category
    tags     = $tags
    status   = $status
  }
}

$body = $items | ConvertTo-Json -Depth 5

try {
  Invoke-RestMethod -Uri $WebhookUrl -Method Post -ContentType "application/json" -Body $body
  Write-Host "OK — $($items.Count) notes indexees vers $WebhookUrl"
} catch {
  Write-Host "ERREUR : $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}