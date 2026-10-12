<#
.SYNOPSIS
    Attaches ahmadwhosecures.is-a.dev to the ahmadwhosecures Cloudflare Pages project.

.DESCRIPTION
    is-a.dev is on the Public Suffix List, so the Cloudflare dashboard cannot add it as a
    custom domain. This script makes the same request through the Cloudflare API, then
    polls until Cloudflare reports the domain as active.

    Run it once, after the is-a.dev pull request has merged and the CNAME is published.
    It needs an API token scoped to Account, Cloudflare Pages, Edit. Revoke the token
    as soon as the script finishes.

    Runs on Windows PowerShell 5.1 and PowerShell 7.

.PARAMETER AccountId
    The 32-character Cloudflare account ID, as shown in the dashboard URL.

.EXAMPLE
    .\Add-PagesCustomDomain.ps1 -AccountId 0123456789abcdef0123456789abcdef

.NOTES
    Author: Ahmad Shaukat
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-f]{32}$')]
    [string]$AccountId,

    [string]$ProjectName = 'ahmadwhosecures',

    [string]$Domain = 'ahmadwhosecures.is-a.dev'
)

$ErrorActionPreference = 'Stop'

# Windows PowerShell 5.1 can default to older TLS versions; the Cloudflare API needs TLS 1.2.
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$secureToken = Read-Host -Prompt 'Cloudflare API token (input hidden)' -AsSecureString
$token = [Net.NetworkCredential]::new('', $secureToken).Password
$headers = @{ Authorization = "Bearer $token" }
$base = "https://api.cloudflare.com/client/v4/accounts/$AccountId/pages/projects/$ProjectName/domains"

try {
    $body = @{ name = $Domain } | ConvertTo-Json -Compress
    $added = Invoke-RestMethod -Method Post -Uri $base -Headers $headers -ContentType 'application/json' -Body $body
    Write-Host "Added $Domain to $ProjectName. Initial status: $($added.result.status)"
}
catch {
    $detail = $_.ErrorDetails.Message
    if ($detail -and $detail -match 'already') {
        Write-Host "$Domain is already attached to $ProjectName. Checking its status."
    }
    else {
        Write-Host "Adding the domain failed: $($_.Exception.Message)"
        if ($detail) { Write-Host $detail }
        $token = $null
        exit 1
    }
}

$status = 'unknown'
for ($i = 1; $i -le 10; $i++) {
    $check = Invoke-RestMethod -Method Get -Uri "$base/$Domain" -Headers $headers
    $status = $check.result.status
    Write-Host "Check $i of 10: $status"
    if ($status -eq 'active') { break }
    Start-Sleep -Seconds 30
}

$token = $null
$headers = $null
$secureToken.Dispose()

if ($status -eq 'active') {
    Write-Host "https://$Domain is live. Revoke the API token in the Cloudflare dashboard now."
}
else {
    Write-Host "Status is still '$status'. Cloudflare can take a few more minutes; re-run the script to check again, then revoke the token."
}
