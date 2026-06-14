
Get-ChildItem "$PSScriptRoot\*.ps1" | Where-Object { $_.Name -ne "_fix-crlf.ps1" } | ForEach-Object {
    $c = [IO.File]::ReadAllText($_.FullName, [Text.Encoding]::UTF8)
    $crlf = [string][char]13 + [char]10
    $c = $c.Replace([string][char]13, "").Replace([string][char]10, $crlf)
    [IO.File]::WriteAllText($_.FullName, $c, [Text.Encoding]::UTF8)
    Write-Host "CRLF: $($_.Name)"
}
