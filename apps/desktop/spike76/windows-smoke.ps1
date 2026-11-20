$ErrorActionPreference = 'Stop'
$run = Join-Path $env:RUNNER_TEMP ('rift76-' + [guid]::NewGuid())
$install = Join-Path $run 'installed'
$results = New-Item -ItemType Directory -Path (Join-Path $run 'results') -Force
$profileDir = Join-Path $run 'profile'
$env:RIFT76_RESULTS = $results.FullName
$exe = Join-Path $install 'Rift Legends Spike.exe'
function Install-Build($version) {
    $setup = Get-Item "release/$version/RiftLegends-$version.exe"
    $p = Start-Process $setup.FullName -ArgumentList "/S /currentuser /D=$install" -PassThru -Wait
    if ($p.ExitCode -ne 0 -or !(Test-Path $exe)) { throw "Install failed for $version, exit $($p.ExitCode)" }
}
function Test-Installed($mode) {
    $env:RIFT76_TEST = $mode
    $oldPath = $env:Path
    try {
        $env:Path = "$env:SystemRoot\System32;$env:SystemRoot"
        $p = Start-Process $exe -ArgumentList "--user-data-dir=`"$profileDir`"" -PassThru -RedirectStandardError "$results/$mode.log"
        if (!$p.WaitForExit(120000)) { $p.Kill($true); throw "Timeout in $mode" }
        if ($p.ExitCode -ne 0 -or !(Test-Path "$results/$mode.json")) { throw "Failed $mode, exit $($p.ExitCode)" }
    } finally { $env:Path = $oldPath }
}
$rule = 'Rift76-' + [guid]::NewGuid()
$disabled = @(Get-NetFirewallProfile | Where-Object { $_.Enabled -eq 'False' })
try {
    foreach ($firewallProfile in $disabled) { Set-NetFirewallProfile -Name $firewallProfile.Name -Enabled True }
    New-NetFirewallRule -Name $rule -DisplayName $rule -Direction Outbound -Program $exe -Action Block -Profile Any | Out-Null
    if ((Get-NetFirewallProfile -PolicyStore ActiveStore | Where-Object { $_.Enabled -ne 'True' })) { throw 'Inactive firewall profile' }
    Install-Build '0.76.1'
    Test-Installed create
    Test-Installed reopen
    Test-Installed recovery
    Install-Build '0.76.2'
    Test-Installed upgrade
    Copy-Item 'docs/research/spikes-2026-11/s76-linux.career' "$results/cross.sqlite"
    if ((Get-FileHash "$results/cross.sqlite").Hash -ne '8834d7e319d53553ad4475cc3a4fb2e604b3a5df787249a32d867428d19222ac') {
        throw 'Linux career checksum mismatch'
    }
    Test-Installed cross
} finally {
    Remove-NetFirewallRule -Name $rule -ErrorAction SilentlyContinue
    foreach ($firewallProfile in $disabled) { Set-NetFirewallProfile -Name $firewallProfile.Name -Enabled False }
    $evidence = New-Item -ItemType Directory -Force 'release/windows-evidence'
    Copy-Item "$results/*.json", "$results/*.log" $evidence -ErrorAction SilentlyContinue
    Get-ChildItem 'release/*/*.exe' | ForEach-Object {
        [pscustomobject]@{Name=$_.Name; Bytes=$_.Length; SHA256=(Get-FileHash $_.FullName).Hash}
    } | Export-Csv (Join-Path $evidence 'packages.csv') -NoTypeInformation
}
