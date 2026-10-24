# run-server.ps1 — Local Web Server for Highland Climate & Hotspot Dashboard
Param(
    [int]$Port = 8000
)

$hostUrl = "http://localhost:$Port/"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Highland Climate & Hotspot Interactive Dashboard (2022-2023)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Starting local web server at $hostUrl ..." -ForegroundColor Yellow

# Try Python first if available
$pyCmd = Get-Command python, py -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pyCmd) {
    try {
        $testPy = & $pyCmd.Name --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Running via Python HTTP Server on port $Port..." -ForegroundColor Green
            Start-Process $hostUrl
            & $pyCmd.Name -m http.server $Port
            exit
        }
    } catch {}
}

# Native PowerShell HttpListener fallback (works out-of-the-box on all Windows systems)
Write-Host "Running native PowerShell HTTP Server on port $Port..." -ForegroundColor Green
$server = New-Object System.Net.HttpListener
$server.Prefixes.Add($hostUrl)

try {
    $server.Start()
} catch {
    Write-Host "Error: Could not bind to port $Port. It might be in use." -ForegroundColor Red
    Write-Host "Try running: .\run-server.ps1 -Port 8080" -ForegroundColor Yellow
    exit 1
}

Write-Host "Server is running! Press Ctrl+C to stop." -ForegroundColor White
Write-Host "Opening dashboard in default browser..." -ForegroundColor Green
Start-Process $hostUrl

$root = (Get-Location).Path

try {
    while ($server.IsListening) {
        $context = $server.GetContext()
        $request = $context.Request
        $response = $context.Response

        $relPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($relPath)) { $relPath = "index.html" }
        $relPath = [System.Uri]::UnescapeDataString($relPath)
        $filePath = [System.IO.Path]::Combine($root, $relPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))

        if ([System.IO.File]::Exists($filePath)) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".png"     { "image/png" }
                ".jpg"     { "image/jpeg" }
                ".svg"     { "image/svg+xml" }
                ".geojson" { "application/geo+json; charset=utf-8" }
                Default    { "application/octet-stream" }
            }
            $response.ContentType = $contentType
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.OutputStream.Close()
    }
} finally {
    $server.Stop()
    $server.Close()
    Write-Host "`nServer stopped." -ForegroundColor Yellow
}
