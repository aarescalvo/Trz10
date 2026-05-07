<#
.SYNOPSIS
    Helper para enviar datos RAW a impresora Windows via Win32 Spooler API.
    Usado por Printer Bridge (index.js).
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

try {
    # Cargar Win32 Spooler API
    $code = @'
using System;
using System.Runtime.InteropServices;

public class WinSpoolBridge
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

    # Evitar error si el tipo ya fue cargado en esta sesion de PowerShell
    if (-not ([System.Management.Automation.PSTypeName]'WinSpoolBridge').Type) {
        Add-Type -TypeDefinition $code -Language CSharp | Out-Null
    }

} catch {
    Write-Output "ERROR:Cargando Win32 API: $($_.Exception.Message)"
    exit 1
}

# Verificar archivo existe
if (-not (Test-Path $FilePath)) {
    Write-Output "ERROR:Archivo no encontrado: $FilePath"
    exit 1
}

# Verificar tamaño
$fileSize = (Get-Item $FilePath).Length
if ($fileSize -eq 0) {
    Write-Output "ERROR:Archivo vacio: $FilePath"
    exit 1
}

$docInfo = New-Object WinSpoolBridge+DOC_INFO_1
$docInfo.pDocName = "PrinterBridge"
$docInfo.pOutputFile = $null
$docInfo.pDatatype = "RAW"

$hPrinter = [IntPtr]::Zero

# Abrir impresora
$result = [WinSpoolBridge]::OpenPrinter($PrinterName, [ref]$hPrinter, [IntPtr]::Zero)
if (-not $result) {
    $errCode = [WinSpoolBridge]::GetLastError()
    $errMsg = switch ($errCode) {
        5    { "Acceso denegado. Ejecuta el bridge como Administrador." }
        1801 {
            # Listar impresoras disponibles para ayudar al usuario
            $available = (Get-Printer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name) -join ", "
            "Impresora '$PrinterName' no encontrada. Impresoras disponibles: $available"
        }
        3015 { "La impresora esta pausada. Reanudala desde Configuracion de impresion." }
        13   { "Permiso insuficiente. Ejecuta como Administrador." }
        2    {
            $available = (Get-Printer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name) -join ", "
            "Impresora no encontrada: '$PrinterName'. Disponibles: $available"
        }
        default { "Error de Windows $errCode al abrir impresora." }
    }
    Write-Output "ERROR:$errMsg (codigo: $errCode)"
    exit 1
}

try {
    $data = [System.IO.File]::ReadAllBytes($FilePath)
    $written = 0

    # Iniciar documento de impresion
    $result = [WinSpoolBridge]::StartDocPrinter($hPrinter, 1, [ref]$docInfo)
    if (-not $result) {
        $errCode = [WinSpoolBridge]::GetLastError()
        Write-Output "ERROR:StartDocPrinter fallo (codigo: $errCode)"
        exit 1
    }

    # Iniciar pagina
    $result = [WinSpoolBridge]::StartPagePrinter($hPrinter)
    if (-not $result) {
        $errCode = [WinSpoolBridge]::GetLastError()
        Write-Output "ERROR:StartPagePrinter fallo (codigo: $errCode)"
        [WinSpoolBridge]::EndDocPrinter($hPrinter) | Out-Null
        exit 1
    }

    # Escribir datos
    $result = [WinSpoolBridge]::WritePrinter($hPrinter, $data, $data.Length, [ref]$written)
    if (-not $result) {
        $errCode = [WinSpoolBridge]::GetLastError()
        Write-Output "ERROR:WritePrinter fallo (codigo: $errCode)"
        [WinSpoolBridge]::EndPagePrinter($hPrinter) | Out-Null
        [WinSpoolBridge]::EndDocPrinter($hPrinter) | Out-Null
        exit 1
    }

    # Finalizar pagina y documento
    [WinSpoolBridge]::EndPagePrinter($hPrinter) | Out-Null
    [WinSpoolBridge]::EndDocPrinter($hPrinter) | Out-Null

    Write-Output "OK:$written"

} catch {
    Write-Output "ERROR:Excepcion: $($_.Exception.Message)"
} finally {
    if ($hPrinter -ne [IntPtr]::Zero) {
        [WinSpoolBridge]::ClosePrinter($hPrinter) | Out-Null
    }
}
