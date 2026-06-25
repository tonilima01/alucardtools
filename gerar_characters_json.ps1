$root = "C:\alucard-tools\public\characters"
$out = "$root\characters.json"

$baseByClass = @{
    "archer" = "Archer.smd"
    "assassin" = "Assasin.smd"
    "atalanta" = "Atalanta.smd"
    "magician" = "Mago.smd"
    "mechanician" = "Mecanico.smd"
    "priestess" = "Sacer.smd"
    "shaman" = "Shaman.smd"
    "knight" = "Kinght.smd"
    "fighter" = "Lutador.smd"
    "pikeman" = "Pikeman.smd"
}

$nameByClass = @{
    "archer" = "Archer"
    "assassin" = "Assassin"
    "atalanta" = "Atalanta"
    "magician" = "Magician"
    "mechanician" = "Mechanician"
    "priestess" = "Priestess"
    "shaman" = "Shaman"
    "knight" = "Knight"
    "fighter" = "Fighter"
    "pikeman" = "Pikeman"
}

$characters = @()

Get-ChildItem $root -Directory | Sort-Object Name | ForEach-Object {
    $id = $_.Name
    $dir = $_.FullName

    $files = Get-ChildItem $dir -File |
        Where-Object { $_.Extension -match "\.(smd|bmp|tga|dds|png)$" } |
        Sort-Object Name |
        Select-Object -ExpandProperty Name

    $smdFiles = $files | Where-Object { $_ -match "\.smd$" }

    if ($smdFiles.Count -eq 0) {
        Write-Host ("Ignorando {0}: sem .smd" -f $id)
        return
    }

    $preferredBase = $baseByClass[$id]
    if ($preferredBase -and ($smdFiles -contains $preferredBase)) {
        $base = $preferredBase
    } else {
        $base = $smdFiles[0]
    }

    $name = $nameByClass[$id]
    if (-not $name) {
        $name = $id
    }

    $characters += [PSCustomObject]@{
        id = $id
        name = $name
        base = $base
        files = @($files)
        smdFiles = @($smdFiles)
        defaultModel = $base
    }

    Write-Host "$name -> Base: $base | Arquivos: $($files.Count)"
}

$result = [PSCustomObject]@{
    characters = $characters
}

$result | ConvertTo-Json -Depth 10 | Set-Content $out -Encoding UTF8

Write-Host ""
Write-Host "characters.json gerado:"
Write-Host $out
