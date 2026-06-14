# Parse services from compose via Docker (fallback: line parser)
function Get-ComposeServicesFromFile {
    param(
        [string]$ModuleRoot,
        [string]$ComposeFile = "docker-compose.yml",
        [string[]]$ExtraComposeFiles = @()
    )

    $composePath = Join-Path $ModuleRoot $ComposeFile
    if (-not (Test-Path $composePath)) { return @() }

    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Push-Location $ModuleRoot
        try {
            $args = @("compose", "-f", $ComposeFile)
            foreach ($f in $ExtraComposeFiles) { $args += @("-f", $f) }
            $args += @("config", "--services")
            $names = & docker @args 2>$null
            if ($LASTEXITCODE -eq 0 -and $names) {
                return @($names | ForEach-Object {
                    $n = $_.Trim()
                    [PSCustomObject]@{
                        Name          = $n
                        ContainerName = $n
                        Context       = '.'
                        Dockerfile    = 'Dockerfile'
                    }
                })
            }
        } finally { Pop-Location }
    }

    # Fallback: legacy parser from ops toolkit
    $prev = $OpsComposeFile
    $script:OpsComposeFile = $ComposeFile
    try { return @(Get-DockerServices) } finally { $script:OpsComposeFile = $prev }
}
