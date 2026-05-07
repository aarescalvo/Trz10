<#
.SYNOPSIS
    Helper para enviar datos RAW a impresora Windows.
    Usado por Printer Bridge (index.js).

    Estrategia en 3 pasos:
    1) Win32 Spooler API con RAW (StartDocPrinter) - Zebra
    2) Win32 Spooler: OpenPrinter + WritePrinter directo (sin StartDocPrinter) - Datamax
    3) Si ambos fallan, indica instalar driver Generic/Text Only

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
# Cargar Win32 API
# ============================================================
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
    Write-Output "ERROR:Cargando Win32 API: $($_.Exception.Message)"
    exit 1
}

# ============================================================
# Metodo 1: Spooler completo (Open + StartDoc + StartPage + Write + End)
# Funciona con Zebra y drivers que soportan RAW
# ============================================================
function Print-viaSpoolerFull {
    param([string]$Printer, [byte[]]$Bytes)

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
# Metodo 2: OpenPrinter + WritePrinter directo (sin StartDoc)
# Para drivers Datamax que no soportan datatype RAW (error 1804)
# WritePrinter envia bytes raw sin validar datatype
# ============================================================
function Print-viaWriteDirect {
    param([string]$Printer, [byte[]]$Bytes)

    $hPrinter = [IntPtr]::Zero

    $result = [SpoolerRaw]::OpenPrinter($Printer, [ref]$hPrinter, [IntPtr]::Zero)
    if (-not $result) {
        $errCode = [SpoolerRaw]::GetLastError()
        throw "OpenPrinter codigo:$errCode"
    }

    try {
        $written = 0

        $result = [SpoolerRaw]::WritePrinter($hPrinter, $Bytes, $Bytes.Length, [ref]$written)
        if (-not $result) {
            $errCode = [SpoolerRaw]::GetLastError()
            throw "WritePrinter codigo:$errCode"
        }

        return @{ success = $true; bytes = $written }

    } finally {
        if ($hPrinter -ne [IntPtr]::Zero) {
            [SpoolerRaw]::ClosePrinter($hPrinter) | Out-Null
        }
    }
}

# ============================================================
# Ejecucion principal
# ============================================================

# Intentar Metodo 1: Spooler completo con RAW
$spoolerError = $null

try {
    $result = Print-viaSpoolerFull -Printer $PrinterName -Bytes $data
    if ($result.success) {
        Write-Output "OK:$($result.bytes)"
        exit 0
    }
} catch {
    $spoolerError = $_.Exception.Message
}

# Si fallo con error 1804 (datatype no soportado), intentar Metodo 2
if ($spoolerError -match 'codigo:1804') {
    try {
        $result = Print-viaWriteDirect -Printer $PrinterName -Bytes $data
        if ($result.success) {
            Write-Output "OK:$($result.bytes)"
            exit 0
        }
    } catch {
        $directError = $_.Exception.Message
        Write-Output "ERROR:El driver Datamax no soporta RAW (error 1804) y WritePrinter directo tambien fallo: $directError"
        Write-Output "SOLUCION: Instala un segundo driver 'Generic / Text Only' para la misma impresora."
        Write-Output "  1. Abrí: Dispositivos e impresoras > Agregar impresora"
        Write-Output "  2. 'La impresora que quiero no esta en la lista'"
        Write-Output "  3. 'Agregar una impresora local con ajustes manuales'"
        Write-Output "  4. Usar puerto existente: USB001"
        Write-Output "  5. Fabricante: Generic > Modelo: Generic / Text Only"
        Write-Output "  6. Nombre: Datamax Generic (RAW)"
        Write-Output "  7. Luego configurar el bridge con: Datamax Generic (RAW)"
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
