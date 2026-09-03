while ($true) {
    Write-Host "Starting 3CX Webhook Tunnel on port 8000..."
    npx -y localtunnel --port 8000 --subdomain metal-ghosts-care
    Start-Sleep -Seconds 3
}
