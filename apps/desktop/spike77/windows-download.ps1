$ErrorActionPreference = 'Stop'
# T7 on the NSIS build (S1: connection reset mid-file). Unverified until the CI job runs.
$run = Join-Path $env:RUNNER_TEMP ('rift77-' + [guid]::NewGuid())
$install = Join-Path $run 'installed'
$profileDir = Join-Path $run 'profile'
$evidence = New-Item -ItemType Directory -Force 'release/windows-evidence-77'
$exe = Join-Path $install 'Rift Legends Spike.exe'
$manifest = Get-Content 'apps/desktop/spike77/manifest.json' -Raw | ConvertFrom-Json
$setup = Get-Item 'release/0.76.1/RiftLegends-0.76.1.exe'
$p = Start-Process $setup.FullName -ArgumentList "/S /currentuser /D=$install" -PassThru -Wait
if ($p.ExitCode -ne 0 -or !(Test-Path $exe)) { throw "Install failed, exit $($p.ExitCode)" }
function Step($name, $base) {
    $dir = New-Item -ItemType Directory -Force (Join-Path $evidence $name)
    $env:RIFT76_TEST = 'dl'; $env:RIFT76_RESULTS = $dir.FullName
    if ($base) { $env:RIFT77_BASE = $base } else { Remove-Item Env:RIFT77_BASE -ErrorAction SilentlyContinue }
    if ($name -like '*verify*') { $env:RIFT77_ACTION = 'verify' } else { Remove-Item Env:RIFT77_ACTION -ErrorAction SilentlyContinue }
    $old = $env:Path
    try {
        $env:Path = "$env:SystemRoot\System32;$env:SystemRoot"
        $proc = Start-Process $exe -ArgumentList "--user-data-dir=`"$profileDir`"" -PassThru -RedirectStandardError "$dir/app.log"
        if (!$proc.WaitForExit(120000)) { $proc.Kill($true); throw "Timeout in $name" }
        if ($proc.ExitCode -ne 0 -or !(Test-Path "$dir/dl.json")) { throw "Failed $name, exit $($proc.ExitCode)" }
    } finally { $env:Path = $old }
}
$port = 28077
$proxy = Start-Process node -ArgumentList "apps/desktop/spike77/proxy.cjs $port cut data/en_US/championFull.json:1500000 $evidence/proxy-cut.log" -PassThru
Start-Sleep 2
$rule = 'Rift77-' + [guid]::NewGuid()
$disabled = @(Get-NetFirewallProfile | Where-Object { $_.Enabled -eq 'False' })
try {
    Step '1-cut' "http://127.0.0.1:$port"
    Stop-Process $proxy -Force
    foreach ($fp in $disabled) { Set-NetFirewallProfile -Name $fp.Name -Enabled True }
    New-NetFirewallRule -Name $rule -DisplayName $rule -Direction Outbound -Program $exe -Action Block -Profile Any | Out-Null
    Step '2-offline' $null
    Remove-NetFirewallRule -Name $rule
    foreach ($fp in $disabled) { Set-NetFirewallProfile -Name $fp.Name -Enabled False }
    Step '3-resume' $null
    New-NetFirewallRule -Name $rule -DisplayName $rule -Direction Outbound -Program $exe -Action Block -Profile Any | Out-Null
    foreach ($fp in $disabled) { Set-NetFirewallProfile -Name $fp.Name -Enabled True }
    Step '4-verify-offline' $null
} finally {
    Remove-NetFirewallRule -Name $rule -ErrorAction SilentlyContinue
    foreach ($fp in $disabled) { Set-NetFirewallProfile -Name $fp.Name -Enabled False }
    Stop-Process $proxy -Force -ErrorAction SilentlyContinue
}
# Independent comparison against the pinned manifest, hashing the active cache from disk.
$active = Get-ChildItem $profileDir -Recurse -Directory -Filter $manifest.version | Where-Object { $_.Parent.Name -eq 'ddragon' } | Select-Object -First 1
$manifest.files | ForEach-Object {
    $f = Join-Path $active.FullName $_.path
    [pscustomobject]@{Path=$_.path; ExpectedBytes=$_.size; Bytes=(Get-Item $f).Length; Match=((Get-FileHash $f).Hash.ToLower() -eq $_.sha256)}
} | Export-Csv (Join-Path $evidence 'cache-vs-manifest.csv') -NoTypeInformation
