Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("c:\Web Development\finance-tracker\favicon.png")
$bmp = New-Object System.Drawing.Bitmap($img.Width, $img.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Transparent)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

$radius = 120
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc(0, 0, $radius, $radius, 180, 90)
$path.AddArc($img.Width - $radius, 0, $radius, $radius, 270, 90)
$path.AddArc($img.Width - $radius, $img.Height - $radius, $radius, $radius, 0, 90)
$path.AddArc(0, $img.Height - $radius, $radius, $radius, 90, 90)
$path.CloseFigure()

$g.SetClip($path)
$g.DrawImage($img, 0, 0, $img.Width, $img.Height)

$bmp.Save("c:\Web Development\finance-tracker\favicon_squircle.png", [System.Drawing.Imaging.ImageFormat]::Png)

$path.Dispose()
$g.Dispose()
$bmp.Dispose()
$img.Dispose()
