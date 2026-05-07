<#
.SYNOPSIS
    Helper para enviar datos RAW a impresora Windows.
    Usado por Printer Bridge (index.js).

    Estrategia en 2 pasos:
    1) Intenta via Win32 Spooler API (RAW) - compatible con Zebra
    2) Si falla con error 1804 (datatype no soportado), envia directo al puerto USB - compatible con Datamax

.PARAMETER PrinterName
    Nombre exacto de la impresora en Windows.
.PARAMETER FilePath
    Path al archivo temporal con los datos a imprimir.
.OUTPUTS
    OK:1234        (exitos, 1234 bytes escritos)
    ERROR:mensaje  (error con descripcion)
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

# Verificar archivo existe
if (-not (Test-Path $FilePath)) {
    Write-Output "ERROR:Archivo no encontrado: $FilePath"
    exit 1
}

$fileSize = (Get-Item $FilePath).Length
if ($fileSize -eq 0) {
    Write-Output "ERROR:Archivo vacio: $FilePath"
    exit 1
}

$data = [System.IO.File]::ReadAllBytes($FilePath)

# ============================================================
# Metodo 1: Win32 Spooler API con datatype RAW
# ============================================================
function Print-viaSpooler {
    param([string]$Printer, [byte[]]$Bytes)

    try {
        $code = @'
using System;
using System.Runtime.InteropServices;

public class SpoolerRaw
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOC_INFO_1
    {
        public string pDocName;
        public string pOutputFile;
        public string pDatatype;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, ref DOC_INFO_1 pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("kernel32.dll")]
    public static extern uint GetLastError();
}
'@
        if (-not ([System.Management.Automation.PSTypeName]'SpoolerRaw').Type) {
            Add-Type -TypeDefinition $code -Language CSharp | Out-Null
        }
    } catch {
        throw "Cargando Win32 API: $($_.Exception.Message)"
    }

    $docInfo = New-Object SpoolerRaw+DOC_INFO_1
    $docInfo.pDocName = "PrinterBridge"
    $docInfo.pOutputFile = $null
    $docInfo.pDatatype = "RAW"

    $hPrinter = [IntPtr]::Zero

    $result = [SpoolerRaw]::OpenPrinter($Printer, [ref]$hPrinter, [IntPtr]::Zero)
    if (-not $result) {
        $errCode = [SpoolerRaw]::GetLastError()
        throw "OpenPrinter codigo:$errCode"
    }

    try {
        $written = 0

        $result = [SpoolerRaw]::StartDocPrinter($hPrinter, 1, [ref]$docInfo)
        if (-not $result) {
            $errCode = [SpoolerRaw]::GetLastError()
            throw "StartDocPrinter codigo:$errCode"
        }

        $result = [SpoolerRaw]::StartPagePrinter($hPrinter)
        if (-not $result) {
            $errCode = [SpoolerRaw]::GetLastError()
            [SpoolerRaw]::EndDocPrinter($hPrinter) | Out-Null
            throw "StartPagePrinter codigo:$errCode"
        }

        $result = [SpoolerRaw]::WritePrinter($hPrinter, $Bytes, $Bytes.Length, [ref]$written)
        if (-not $result) {
            $errCode = [SpoolerRaw]::GetLastError()
            [SpoolerRaw]::EndPagePrinter($hPrinter) | Out-Null
            [SpoolerRaw]::EndDocPrinter($hPrinter) | Out-Null
            throw "WritePrinter codigo:$errCode"
        }

        [SpoolerRaw]::EndPagePrinter($hPrinter) | Out-Null
        [SpoolerRaw]::EndDocPrinter($hPrinter) | Out-Null

        return @{ success = $true; bytes = $written }

    } finally {
        if ($hPrinter -ne [IntPtr]::Zero) {
            [SpoolerRaw]::ClosePrinter($hPrinter) | Out-Null
        }
    }
}

# ============================================================
# Metodo 2: Escritura directa al puerto de la impresora (USB/LPT/COM)
# Para impresoras donde el driver no soporta RAW (error 1804)
# ============================================================
function Print-viaPort {
    param([string]$Printer, [byte[]]$Bytes)

    # Obtener el puerto de la impresora
    try {
        $printerObj = Get-Printer -Name $Printer -ErrorAction Stop
        $portName = $printerObj.PortName
    } catch {
        throw "No se pudo obtener el puerto de la impresora '$Printer'"
    }

    # Si es puerto de red (WSD, TCP/IP), intentar resolver
    if ($portName -like "WSD_*" -or $portName -like "*_*") {
        # Para puertos WSD o de red, necesitamos otra estrategia
        throw "La impresora usa puerto de red ($portName). El modo directo a puerto no aplica. Instala un driver Generic/Text Only."
    }

    # Buscar el archivo del puerto en el spooler
    $portPath = "\\.\$portName"

    # Si es USB001, USB002, etc., o LPT1, COM1, etc.
    if ($portName -match '^(USB\d+|LPT\d+|COM\d+)$') {
        $portPath = "\\.\$portName"
    } elseif ($portName -match '^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$') {
        # Puerto IP directo
        throw "Puerto IP detectado ($portName). El bridge deberia recibir por TCP en ese puerto."
    } else {
        $portPath = "\\.\$portName"
    }

    try {
        $fs = [System.IO.File]::OpenWrite($portPath)
        try {
            $fs.Write($Bytes, 0, $Bytes.Length)
            $fs.Flush()
            return @{ success = $true; bytes = $Bytes.Length }
        } finally {
            $fs.Close()
            $fs.Dispose()
        }
    } catch {
        throw "No se pudo escribir al puerto $portPath : $($_.Exception.Message)"
    }
}

# ============================================================
# Ejecucion principal
# ============================================================

# Intentar Metodo 1: Spooler API
$spoolerResult = $null
$spoolerError = $null

try {
    $spoolerResult = Print-viaSpooler -Printer $PrinterName -Bytes $data
    if ($spoolerResult.success) {
        Write-Output "OK:$($spoolerResult.bytes)"
        exit 0
    }
} catch {
    $spoolerError = $_.Exception.Message
}

# Si fallo con error 1804 (datatype no soportado), intentar Metodo 2: Puerto directo
if ($spoolerError -match 'codigo:1804') {
    try {
        $portResult = Print-viaPort -Printer $PrinterName -Bytes $data
        if ($portResult.success) {
            Write-Output "OK:$($portResult.bytes)"
            exit 0
        }
    } catch {
        $portError = $_.Exception.Message
        Write-Output "ERROR:Spooler no soporta RAW (error 1804) y el puerto directo tambien fallo: $portError"
        Write-Output "SOLUCION: Instala la impresora con driver 'Generic / Text Only' (Generico / Solo texto)."
        Write-Output "  1. Panel de control > Dispositivos e impresoras"
        Write-Output "  2. Agregar impresora > La impresora que quiero no esta en la lista"
        Write-Output "  3. Agregar impresora local > Crear puerto nuevo > Usar puerto existente"
        Write-Output "  4. Seleccionar el puerto donde esta conectada la Datamax (ej: USB001)"
        Write-Output "  5. Fabricante: Generic > Modelo: Generic / Text Only"
        Write-Output "  6. Nombrala 'Datamax M-4206 Mark II (Generic)'"
        Write-Output "  7. Configura el bridge con ese nombre"
        exit 1
    }
} else {
    # Error distinto de 1804
    if ($spoolerError -match 'codigo:(\d+)') {
        $errCode = $Matches[1]
        $errMsg = switch ($errCode) {
            5    { "Acceso denegado. Ejecuta el bridge como Administrador." }
            1801 {
                $available = (Get-Printer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name) -join ", "
                "Impresora '$PrinterName' no encontrada. Disponibles: $available"
            }
            3015 { "La impresora esta pausada. Reanudala desde Configuracion." }
            13   { "Permiso insuficiente. Ejecuta como Administrador." }
            2    {
                $available = (Get-Printer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name) -join ", "
                "Impresora no encontrada: '$PrinterName'. Disponibles: $available"
            }
            default { "Error de Spooler $errCode." }
        }
        Write-Output "ERROR:$errMsg"
    } else {
        Write-Output "ERROR:$spoolerError"
    }
    exit 1
}
