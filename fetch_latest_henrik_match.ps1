$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\lrg20\Desktop\TFG'

function Get-EnvValue([string]$Name) {
    $value = [System.Environment]::GetEnvironmentVariable($Name)
    if ($value) { return $value }
    $envPath = Join-Path $PWD '.env'
    if (Test-Path $envPath) {
        $regex = '^\s*' + [regex]::Escape($Name) + '\s*=\s*(.+)\s*$'
        $match = Select-String -Path $envPath -Pattern $regex | Select-Object -First 1
        if ($match) {
            return $match.Matches[0].Groups[1].Value.Trim().Trim('"').Trim("'")
        }
    }
    return $null
}

$riotApiKey = Get-EnvValue 'RIOT_API_KEY'
if (-not $riotApiKey) { throw 'RIOT_API_KEY no esta definida en el entorno ni en .env' }

$henryApiKey = Get-EnvValue 'HENRY_API_KEY'
if (-not $henryApiKey) { throw 'HENRY_API_KEY no esta definida en el entorno ni en .env' }

$riotHeaders = @{
    'X-Riot-Token' = $riotApiKey
    Accept = 'application/json'
    'User-Agent' = 'tfg-valorant-match-fetcher/1.0'
}

$henrikHeaders = @{
    Authorization = $henryApiKey
    Accept = 'application/json'
    'User-Agent' = 'tfg-valorant-match-fetcher/1.0'
}

$name = 'No Screams'
$tag = 'GFS'
$affinity = 'eu'
$platform = 'pc'
$nameEsc = [uri]::EscapeDataString($name)
$tagEsc = [uri]::EscapeDataString($tag)

$accountUrl = "https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/$nameEsc/$tagEsc"
$accountResp = Invoke-WebRequest -Headers $riotHeaders -Uri $accountUrl -Method Get -TimeoutSec 60
$accountObj = $accountResp.Content | ConvertFrom-Json -Depth 100
$puuid = $accountObj.puuid
if (-not $puuid) { throw 'No se pudo obtener el PUUID desde Riot.' }

$matchesUrl = "https://api.henrikdev.xyz/valorant/v4/by-puuid/matches/$affinity/$platform/$puuid?size=1&start=0"
$matchesResp = Invoke-WebRequest -Headers $henrikHeaders -Uri $matchesUrl -Method Get -TimeoutSec 60
$matchesObj = $matchesResp.Content | ConvertFrom-Json -Depth 100
$matchList = @()
if ($null -ne $matchesObj.data) { $matchList = @($matchesObj.data) }
elseif ($null -ne $matchesObj.matches) { $matchList = @($matchesObj.matches) }
else { $matchList = @($matchesObj) }

$firstMatch = $matchList | Select-Object -First 1
if (-not $firstMatch) { throw 'La API no devolvio partidas para ese jugador.' }

$matchId = $null
foreach ($candidate in @(
    $firstMatch.metadata.matchid,
    $firstMatch.metadata.match_id,
    $firstMatch.metadata.id,
    $firstMatch.matchInfo.matchId,
    $firstMatch.matchid,
    $firstMatch.match_id,
    $firstMatch.id
)) {
    if ($candidate -and $candidate.ToString().Trim()) {
        $matchId = $candidate.ToString().Trim()
        break
    }
}
if (-not $matchId) { throw 'No se pudo extraer el match_id de la primera partida.' }

$detailUrls = @("https://api.henrikdev.xyz/valorant/v4/match/$affinity/$matchId", "https://api.henrikdev.xyz/valorant/v2/match/$matchId")
$matchDetail = $null
$usedUrl = $null
foreach ($url in $detailUrls) {
    try {
        $resp = Invoke-WebRequest -Headers $henrikHeaders -Uri $url -Method Get -TimeoutSec 60
        $matchDetail = $resp.Content | ConvertFrom-Json -Depth 100
        $usedUrl = $url
        break
    } catch {
        $matchDetail = $null
    }
}
if (-not $matchDetail) { throw 'No se pudo obtener el detalle completo de la partida.' }

$outFile = Join-Path $PWD 'ultima_partida_no_screams_gfs.txt'
$payload = [ordered]@{
    player = [ordered]@{ name = $name; tag = $tag }
    source = $usedUrl
    matchId = $matchId
    downloadedAt = (Get-Date).ToString('o')
    matchDetail = $matchDetail
}
$payload | ConvertTo-Json -Depth 100 | Set-Content -Path $outFile -Encoding utf8
Write-Output $outFile