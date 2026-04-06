Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("c:\Users\USER\Documents\Anti\급식체크\public\dinner-icon.png")

$bitmap192 = New-Object System.Drawing.Bitmap(192, 192)
$graphics192 = [System.Drawing.Graphics]::FromImage($bitmap192)
$graphics192.DrawImage($img, 0, 0, 192, 192)
$bitmap192.Save("c:\Users\USER\Documents\Anti\급식체크\public\pwa-192x192.png", [System.Drawing.Imaging.ImageFormat]::Png)
$graphics192.Dispose()

$bitmap512 = New-Object System.Drawing.Bitmap(512, 512)
$graphics512 = [System.Drawing.Graphics]::FromImage($bitmap512)
$graphics512.DrawImage($img, 0, 0, 512, 512)
$bitmap512.Save("c:\Users\USER\Documents\Anti\급식체크\public\pwa-512x512.png", [System.Drawing.Imaging.ImageFormat]::Png)
$graphics512.Dispose()

$img.Dispose()
