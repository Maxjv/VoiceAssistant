 = @(
    'c:\TFTE\VoiceAssistant\watcher\gemini\instruccion.txt',
    'c:\TFTE\VoiceAssistant\watcher\gemini\respuesta.txt',
    'c:\TFTE\VoiceAssistant\watcher\gemini\historial.txt'
)
 = @{}
foreach ($f in $files) {
    if (Test-Path $f) { $lastWriteTimes[$f] = (Get-Item $f).LastWriteTime }
    else { $lastWriteTimes[$f] = [DateTime]::MinValue }
}

while ($true) {
    foreach ($f in $files) {
        if (Test-Path $f) {
            $currentWriteTime = (Get-Item $f).LastWriteTime
            if ($currentWriteTime -gt $lastWriteTimes[$f]) {
                $lastWriteTimes[$f] = $currentWriteTime
                Write-Host "
=== CAMBIO DETECTADO EN: $f ==="
                if ($f -match 'historial.txt') {
                    Get-Content $f -Tail 5 | Write-Host
                } else {
                    Get-Content $f -Raw | Write-Host
                }
            }
        }
    }
    Start-Sleep -Seconds 1
}
