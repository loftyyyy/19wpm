param(
    [string]$Template = (Join-Path $PSScriptRoot 'container-app.yaml'),
    [string]$Output = (Join-Path $PSScriptRoot 'container-app.rendered.yaml')
)

$content = Get-Content -LiteralPath $Template -Raw
$missing = [System.Collections.Generic.List[string]]::new()

$rendered = [regex]::Replace($content, '\$\{([A-Za-z_][A-Za-z0-9_]*)\}', {
    param($match)
    $name = $match.Groups[1].Value
    $value = [Environment]::GetEnvironmentVariable($name)
    if ($null -eq $value) {
        $missing.Add($name) | Out-Null
        return $match.Value
    }
    return $value
})

if ($missing.Count -gt 0) {
    $unique = $missing | Sort-Object -Unique
    throw "Missing environment variables: $($unique -join ', ')"
}

[System.IO.File]::WriteAllText(
    $Output,
    $rendered,
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Output "Rendered $Output"
