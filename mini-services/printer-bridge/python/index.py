# -*- coding: utf-8 -*-
"""
Printer Bridge v3.4 - Solemar Alimentaria
==========================================
Puente TCP -> Impresora USB para Windows 7
Compatible con Python 3.8.10 (ultima version para Win7)

Arquitectura:
  Sistema TrazAlan (Next.js) -> TCP/IP :9100 -> Este bridge -> win32print -> USB Datamax Mark II

Metodos de impresion soportados:
  1. WritePrinter RAW con "Generic / Text Only" (RECOMENDADO - mas simple)
  2. WritePrinter RAW con driver Datamax (no funciona - driver absorbe datos)
  3. ExtEscape PASSTHROUGH con "Generic / Text Only" (funciona pero mas complejo)

Puntos clave descubiertos:
  - El driver Datamax NO soporta PASSTHROUGH (ExtEscape retorna 0)
  - El driver "Generic / Text Only" SI soporta PASSTHROUGH (ExtEscape retorna 80)
  - win32print.WritePrinter con RAW no envia datos a la impresora con el driver Datamax
  - WritePrinter RAW con "Generic / Text Only" deberia funcionar (por probar)

Formatos soportados:
  - DPL (Datamax Programming Language)
  - ZPL (Zebra Programming Language)
  - RAW (cualquier dato, incluyendo .itf)

Uso:
  python index.py              (inicio normal)
  python index.py --debug      (modo debug con logs detallados)

Config: printer-config.json o panel web en http://localhost:9101
"""

import os
import sys
import json
import socket
import struct
import threading
import time
import subprocess
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime
from functools import partial

# ============================================================
# Configuracion
# ============================================================
CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'printer-config.json')
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'upload')
TEMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp')

DEFAULT_CONFIG = {
    'printerName': '',             # Nombre exacto de la impresora en Windows
    'printerMethod': 'auto',       # 'auto', 'raw_generic', 'passthrough_generic', 'raw_datamax'
    'tcpPort': 9100,               # Puerto TCP para recibir datos (estandar impresoras)
    'httpPort': 9101,              # Puerto HTTP para panel de control
    'logLevel': 'info',            # info, debug, error
    'autoStart': True,
    'copyCount': 1,                # Cantidad de copias por defecto
    'genericPrinterName': ''       # Nombre del driver "Generic / Text Only" (si es diferente)
}


def load_config():
    """Cargar configuracion desde archivo JSON."""
    try:
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                saved = json.load(f)
                cfg = dict(DEFAULT_CONFIG)
                cfg.update(saved)
                return cfg
    except Exception as e:
        print('[ERROR] Error leyendo config: {}'.format(e))
    return dict(DEFAULT_CONFIG)


def save_config(cfg):
    """Guardar configuracion a archivo JSON."""
    try:
        with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(cfg, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print('[ERROR] Error guardando config: {}'.format(e))
        return False


config = load_config()

# Crear directorios si no existen
for d in [TEMP_DIR, UPLOAD_DIR]:
    if not os.path.exists(d):
        try:
            os.makedirs(d)
        except:
            if d == TEMP_DIR:
                TEMP_DIR = tempfile.gettempdir()

# Limpiar archivos temp viejos (>1 hora)
try:
    ahora = time.time()
    for fname in os.listdir(TEMP_DIR):
        fpath = os.path.join(TEMP_DIR, fname)
        if fname.startswith('print-job-') and fname.endswith('.raw'):
            try:
                if os.path.getmtime(fpath) < ahora - 3600:
                    os.unlink(fpath)
            except:
                pass
except:
    pass


# ============================================================
# Logger
# ============================================================
def log(level, msg, data=None):
    """Imprimir log con timestamp."""
    levels = {'error': 0, 'info': 1, 'debug': 2}
    if levels.get(level, 0) <= levels.get(config.get('logLevel', 'info'), 1):
        ts = datetime.now().strftime('%H:%M:%S')
        prefix = {'error': '[ERROR]', 'info': '[OK]', 'debug': '[DEBUG]'}.get(level, '[INFO]')
        line = '{} {} {}'.format(ts, prefix, msg)
        if data is not None:
            line += ' ' + str(data)
        print(line)
        sys.stdout.flush()


# ============================================================
# Deteccion de impresoras Windows
# ============================================================
def try_import_win32print():
    """Intentar importar win32print. Retorna None si no esta disponible."""
    try:
        import win32print
        return win32print
    except ImportError:
        return None


def pywintypes_error():
    """Intentar obtener pywintypes.error para except clauses."""
    try:
        import pywintypes
        return pywintypes.error
    except ImportError:
        return TypeError


def list_printers():
    """Listar impresoras instaladas en Windows."""
    printers = []

    # METODO 1: PowerShell (mas confiable, funciona en todas las versiones de Windows)
    try:
        result = subprocess.check_output(
            'powershell -NoProfile -Command "Get-WmiObject Win32_Printer | Select-Object Name,PortName,DriverName | ConvertTo-Json"',
            shell=True, stderr=subprocess.STDOUT, timeout=10
        )
        data = json.loads(result.decode('mbcs', errors='replace'))
        items = data if isinstance(data, list) else [data]
        for p in items:
            name = p.get('Name', '')
            if name:
                printers.append({
                    'name': name,
                    'description': p.get('DriverName', name),
                    'port': p.get('PortName', '')
                })
        if printers:
            return printers
    except Exception as e:
        log('debug', 'PowerShell listado fallo: {}'.format(e))

    # METODO 2: win32print con nivel 4 (formato simple: pPrinterName, pPortName)
    win32print = try_import_win32print()
    if win32print:
        try:
            flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
            for item in win32print.EnumPrinters(flags, None, 4):
                info = item if isinstance(item, (list, tuple)) else list(item)
                name = info[0] if len(info) > 0 else ''
                port = info[1] if len(info) > 1 else ''
                if name and not name.startswith('pPrinter'):
                    printers.append({'name': name, 'description': name, 'port': port})
            if printers:
                return printers
        except Exception as e:
            log('debug', 'win32print nivel 4 fallo: {}'.format(e))

        # METODO 3: win32print con nivel 1 (formato: Flags, Desc, Name, Comment)
        try:
            flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
            for item in win32print.EnumPrinters(flags, None, 1):
                info = item if isinstance(item, (list, tuple)) else list(item)
                name = info[2] if len(info) > 2 else ''
                desc = info[1] if len(info) > 1 else name
                if name and not name.startswith('p'):
                    printers.append({'name': name, 'description': desc, 'port': ''})
            if printers:
                return printers
        except Exception as e:
            log('error', 'Error listando impresoras: {}'.format(e))

    # METODO 4: Fallback PowerShell simple (sin JSON)
    try:
        result = subprocess.check_output(
            'powershell -NoProfile -Command "Get-WmiObject Win32_Printer | Select-Object -ExpandProperty Name"',
            shell=True, stderr=subprocess.STDOUT, timeout=10
        )
        names = result.decode('mbcs', errors='replace').strip().split('\r\n')
        return [{'name': n.strip(), 'description': n.strip(), 'port': ''} for n in names if n.strip()]
    except Exception as e:
        log('error', 'Error listando impresoras (fallback): {}'.format(e))
        return []

    return printers


def get_printer_port(printer_name):
    """Obtener el puerto de la impresora (ej: USB001, LPT1, etc)."""
    win32print = try_import_win32print()
    if win32print:
        try:
            hPrinter = win32print.OpenPrinter(printer_name)
            try:
                printer_info = {}
                win32print.GetPrinter(hPrinter, 2, printer_info)
                return printer_info.get('pPortName', '')
            finally:
                win32print.ClosePrinter(hPrinter)
        except:
            pass
    return ''


# ============================================================
# Metodos de impresion
# ============================================================

def print_writeprinter_raw(printer_name, data):
    """
    Metodo 1: WritePrinter con datatype RAW (el mas simple).

    Equivalente a 'copy archivo lpt1 /b' del sistema viejo.
    win32print con datatype RAW envia bytes directos al puerto USB.

    Con "Generic / Text Only":
    - El driver no procesa los datos, los pasa directo al puerto USB
    - NO necesita PASSTHROUGH porque el driver Generic ya es passthrough

    Args:
        printer_name: Nombre exacto de la impresora en Windows
        data: bytes o str con los datos (DPL) a imprimir

    Returns:
        dict con {success: bool, bytes_written: int, method: str, error: str}
    """
    win32print = try_import_win32print()

    if not win32print:
        return {
            'success': False,
            'method': 'WritePrinter RAW',
            'error': 'pywin32 no esta instalado. Ejecuta: pip install pywin32'
        }

    if isinstance(data, str):
        data = data.encode('latin-1', errors='replace')

    if len(data) == 0:
        return {'success': False, 'method': 'WritePrinter RAW', 'error': 'Datos vacios'}

    try:
        hPrinter = win32print.OpenPrinter(printer_name)
        try:
            # DOC_INFO_1 con RAW = bytes directos al puerto (sin procesar por driver)
            docInfo = ['PrinterBridge', None, 'RAW']
            win32print.StartDocPrinter(hPrinter, 1, docInfo)
            try:
                win32print.StartPagePrinter(hPrinter)
                try:
                    written = win32print.WritePrinter(hPrinter, data)
                    win32print.EndPagePrinter(hPrinter)
                    win32print.EndDocPrinter(hPrinter)

                    log('info', 'WritePrinter RAW OK - {} bytes -> "{}"'.format(written, printer_name))
                    return {'success': True, 'bytes_written': written, 'method': 'WritePrinter RAW'}

                except Exception as e2:
                    try:
                        win32print.EndPagePrinter(hPrinter)
                    except:
                        pass
                    raise e2

            except Exception as e2:
                try:
                    win32print.EndDocPrinter(hPrinter)
                except:
                    pass
                raise e2

        finally:
            win32print.ClosePrinter(hPrinter)

    except Exception as e:
        err_msg = str(e)
        err_code = None
        if hasattr(e, 'winerror'):
            err_code = e.winerror
        elif hasattr(e, 'args') and len(e.args) > 0:
            err_code = e.args[0] if isinstance(e.args[0], int) else None

        if err_code == 5:
            err_msg = 'Acceso denegado. Ejecuta como Administrador.'
        elif err_code in (1801, 2):
            err_msg = 'Impresora "{}" no encontrada.'.format(printer_name)
        elif err_code == 3015:
            err_msg = 'La impresora esta pausada.'

        log('error', 'WritePrinter RAW error: {}'.format(err_msg))
        return {'success': False, 'method': 'WritePrinter RAW', 'error': err_msg}


def print_passthrough(printer_name, data):
    """
    Metodo 2: ExtEscape PASSTHROUGH (mas complejo pero confirma soporte).

    Usa la funcion ExtEscape de Win32 API con el escape PASSTHROUGH.
    El driver "Generic / Text Only" soporta esto (retorna 80).
    El driver Datamax NO lo soporta (retorna 0).

    Args:
        printer_name: Nombre exacto de la impresora en Windows
        data: bytes o str con los datos a imprimir

    Returns:
        dict con {success: bool, bytes_written: int, method: str, error: str}
    """
    win32print = try_import_win32print()

    if not win32print:
        return {
            'success': False,
            'method': 'PASSTHROUGH',
            'error': 'pywin32 no esta instalado. Ejecuta: pip install pywin32'
        }

    if isinstance(data, str):
        data = data.encode('latin-1', errors='replace')

    if len(data) == 0:
        return {'success': False, 'method': 'PASSTHROUGH', 'error': 'Datos vacios'}

    # PASSTHROUGH escape code
    PASSTHROUGH = 4197

    try:
        hPrinter = win32print.OpenPrinter(printer_name)
        try:
            # Preparar datos con prefijo de longitud (4 bytes, little-endian)
            # ExtEscape PASSTHROUGH requiere: DWORD cbSize seguido de los datos
            size = len(data)
            payload = struct.pack('<I', size) + data

            result = win32print.ExtEscape(
                hPrinter, PASSTHROUGH,
                len(payload), payload,
                0, None
            )

            if result > 0:
                log('info', 'PASSTHROUGH OK - {} bytes -> "{}" (ExtEscape retorno: {})'.format(size, printer_name, result))
                return {'success': True, 'bytes_written': size, 'method': 'PASSTHROUGH', 'escape_result': result}
            else:
                log('error', 'PASSTHROUGH FALLIDO - ExtEscape retorno: {} (0 = no soportado por el driver)'.format(result))
                return {
                    'success': False,
                    'method': 'PASSTHROUGH',
                    'error': 'Driver no soporta PASSTHROUGH (ExtEscape retorno {}). Usar "Generic / Text Only".'.format(result),
                    'escape_result': result
                }

        finally:
            win32print.ClosePrinter(hPrinter)

    except Exception as e:
        err_msg = str(e)
        err_code = None
        if hasattr(e, 'winerror'):
            err_code = e.winerror

        if err_code == 5:
            err_msg = 'Acceso denegado. Ejecuta como Administrador.'
        elif err_code in (1801, 2):
            err_msg = 'Impresora "{}" no encontrada.'.format(printer_name)

        log('error', 'PASSTHROUGH error: {}'.format(err_msg))
        return {'success': False, 'method': 'PASSTHROUGH', 'error': err_msg}


def test_passthrough_support(printer_name):
    """
    Probar si el driver soporta PASSTHROUGH enviando un paquete vacio.

    Returns:
        dict con {supported: bool, escape_result: int, printer: str}
    """
    win32print = try_import_win32print()

    if not win32print:
        return {'supported': False, 'escape_result': -1, 'printer': printer_name, 'error': 'pywin32 no instalado'}

    PASSTHROUGH = 4197

    try:
        hPrinter = win32print.OpenPrinter(printer_name)
        try:
            # Enviar paquete minimo (4 bytes de longitud = 0)
            payload = struct.pack('<I', 0)

            result = win32print.ExtEscape(
                hPrinter, PASSTHROUGH,
                len(payload), payload,
                0, None
            )

            supported = result > 0
            log('info', 'PASSTHROUGH test "{}": {}'.format(printer_name, 'SOPORTADO (ret={})'.format(result) if supported else 'NO soportado (ret={})'.format(result)))
            return {
                'supported': supported,
                'escape_result': result,
                'printer': printer_name
            }

        finally:
            win32print.ClosePrinter(hPrinter)

    except Exception as e:
        return {'supported': False, 'escape_result': -1, 'printer': printer_name, 'error': str(e)}


def print_auto(printer_name, data):
    """
    Metodo automatico: intenta el mejor metodo segun la configuracion.

    Estrategia:
    1. Si printerMethod = 'raw_generic' -> WritePrinter RAW con Generic / Text Only
    2. Si printerMethod = 'passthrough_generic' -> PASSTHROUGH con Generic / Text Only
    3. Si printerMethod = 'raw_datamax' -> WritePrinter RAW con driver Datamax
    4. Si printerMethod = 'auto':
       a. Intenta WritePrinter RAW con la impresora configurada
       b. Si falla y hay Generic / Text Only configurado, intenta con esa
       c. Si falla, intenta PASSTHROUGH con Generic / Text Only

    Args:
        printer_name: Nombre de la impresora configurada
        data: bytes o str con los datos a imprimir

    Returns:
        dict con resultado de la impresion
    """
    if isinstance(data, str):
        data = data.encode('latin-1', errors='replace')

    method = config.get('printerMethod', 'auto')
    generic_name = config.get('genericPrinterName', 'Generic / Text Only')

    if method == 'raw_generic':
        # Usar directamente Generic / Text Only con WritePrinter RAW
        target = generic_name
        if not target:
            # Buscar automaticamente
            printers = list_printers()
            for p in printers:
                if 'generic' in p['name'].lower() and 'text' in p['name'].lower():
                    target = p['name']
                    break
        if not target:
            return {'success': False, 'method': 'Auto (RAW Generic)', 'error': 'No se encontro "Generic / Text Only". Configura genericPrinterName.'}
        return print_writeprinter_raw(target, data)

    elif method == 'passthrough_generic':
        target = generic_name
        if not target:
            printers = list_printers()
            for p in printers:
                if 'generic' in p['name'].lower() and 'text' in p['name'].lower():
                    target = p['name']
                    break
        if not target:
            return {'success': False, 'method': 'Auto (PASSTHROUGH Generic)', 'error': 'No se encontro "Generic / Text Only". Configura genericPrinterName.'}
        return print_passthrough(target, data)

    elif method == 'raw_datamax':
        return print_writeprinter_raw(printer_name, data)

    else:  # auto
        log('info', 'Modo AUTO: intentando metodos en orden...')

        # Paso 1: WritePrinter RAW con la impresora configurada
        log('debug', 'AUTO: Paso 1 - WritePrinter RAW con "{}"'.format(printer_name))
        result = print_writeprinter_raw(printer_name, data)
        if result.get('success'):
            return result

        error1 = result.get('error', '')

        # Paso 2: WritePrinter RAW con Generic / Text Only
        target = generic_name
        if not target:
            printers = list_printers()
            for p in printers:
                if 'generic' in p['name'].lower() and 'text' in p['name'].lower():
                    target = p['name']
                    break
        if target:
            log('debug', 'AUTO: Paso 2 - WritePrinter RAW con "{}"'.format(target))
            result2 = print_writeprinter_raw(target, data)
            if result2.get('success'):
                return result2

            # Paso 3: PASSTHROUGH con Generic / Text Only
            log('debug', 'AUTO: Paso 3 - PASSTHROUGH con "{}"'.format(target))
            result3 = print_passthrough(target, data)
            if result3.get('success'):
                return result3

            return {
                'success': False,
                'method': 'Auto (todos fallaron)',
                'error': 'Ningun metodo funciono. Errores: 1) {} 2) {} 3) {}'.format(
                    error1, result2.get('error', '?'), result3.get('error', '?')
                )
            }

        # No hay Generic / Text Only
        return {
            'success': False,
            'method': 'Auto',
            'error': 'No se encontro "Generic / Text Only" para fallback. Error original: {}'.format(error1)
        }


def print_file(printer_name, filepath, method=None):
    """
    Imprimir un archivo (ej: .itf) directo a la impresora.

    Args:
        printer_name: Nombre de la impresora
        filepath: Path al archivo
        method: 'raw_generic', 'passthrough_generic', 'raw_datamax', 'auto' (None = usar config)

    Returns:
        dict con resultado
    """
    if not os.path.exists(filepath):
        return {'success': False, 'error': 'Archivo no encontrado: {}'.format(filepath)}

    try:
        with open(filepath, 'rb') as f:
            data = f.read()
    except Exception as e:
        return {'success': False, 'error': 'Error leyendo archivo: {}'.format(e)}

    if len(data) == 0:
        return {'success': False, 'error': 'Archivo vacio: {}'.format(filepath)}

    log('info', 'Imprimiendo archivo: {} ({} bytes)'.format(filepath, len(data)))

    if method:
        # Usar metodo especifico
        old_method = config.get('printerMethod')
        config['printerMethod'] = method
        result = print_auto(printer_name, data)
        config['printerMethod'] = old_method
        result['file'] = filepath
        result['file_size'] = len(data)
        return result
    else:
        result = print_auto(printer_name, data)
        result['file'] = filepath
        result['file_size'] = len(data)
        return result


# ============================================================
# Funcion legacy print_raw (mantiene compatibilidad)
# ============================================================
def print_raw(printer_name, data):
    """
    Imprimir datos DPL/ZPL en la impresora.

    Usa el metodo configurado (auto por defecto).
    Mantiene compatibilidad con el resto del codigo.
    """
    return print_auto(printer_name, data)


# ============================================================
# Servidor TCP (puerto 9100) - Recibe ZPL/DPL del sistema
# ============================================================
print_count = 0
last_print_time = ''
last_print_error = ''
last_print_method = ''
lock = threading.Lock()


def handle_tcp_client(conn, addr):
    """Manejar una conexion TCP entrante."""
    global print_count, last_print_time, last_print_error, last_print_method

    remote = '{}:{}'.format(addr[0], addr[1])
    log('info', 'Conexion entrante desde {}'.format(remote))

    chunks = []
    total_bytes = 0

    try:
        conn.settimeout(30)  # 30 segundos

        while True:
            try:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                chunks.append(chunk)
                total_bytes += len(chunk)
                log('debug', 'Recibidos {} bytes (total: {})'.format(len(chunk), total_bytes))
            except socket.timeout:
                log('error', 'Timeout esperando datos')
                break
            except Exception as e:
                log('error', 'Error recibiendo datos: {}'.format(e))
                break
    finally:
        try:
            conn.close()
        except:
            pass

    if total_bytes == 0:
        log('info', 'Conexion cerrada sin datos')
        return

    printer_name = config.get('printerName', '')
    if not printer_name:
        log('error', 'No hay impresora configurada')
        last_print_error = 'No hay impresora configurada'
        return

    data = b''.join(chunks)

    # Determinar tipo de contenido para el log
    sample = data[:100].decode('latin-1', errors='replace') if data else ''
    tipo = 'RAW'
    if sample.startswith('^XA'):
        tipo = 'ZPL'
    elif sample.startswith('<STX>') or (len(sample) > 0 and sample[0] == '\x02'):
        tipo = 'DPL'
    elif 'SO' in sample[:50] and '1K' in sample[:100]:
        tipo = 'DPL (Datamax)'

    log('info', 'Recibido {} bytes ({}) desde {}'.format(total_bytes, tipo, remote))

    with lock:
        result = print_raw(printer_name, data)
        print_count += 1
        last_print_time = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
        last_print_method = result.get('method', '?')

        if result['success']:
            log('info', 'Impresion #{} exitosa ({} bytes escritos) [{}]'.format(print_count, result.get('bytes_written', '?'), result.get('method', '?')))
            last_print_error = ''
        else:
            log('error', 'Impresion #{} fallada: {}'.format(print_count, result.get('error', '?')))
            last_print_error = result.get('error', 'Error desconocido')


def start_tcp_server():
    """Iniciar servidor TCP para recibir datos de impresion."""
    port = config.get('tcpPort', 9100)

    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    try:
        server.bind(('0.0.0.0', port))
    except Exception as e:
        err_str = str(e)
        if 'Address already in use' in err_str or 'EADDRINUSE' in err_str or '10048' in err_str:
            print('')
            print('========================================================')
            print('  ERROR: Puerto {} ya esta en uso.'.format(port))
            print('  Puede haber otra instancia del bridge corriendo.')
            print('  Ejecuta: taskkill /F /IM python.exe')
            print('========================================================')
            print('')
        else:
            print('ERROR al bindear puerto {}: {}'.format(port, e))
        sys.exit(1)

    server.listen(5)
    server.settimeout(1)  # Para poder cerrar limpiamente

    log('info', 'Servidor TCP escuchando en 0.0.0.0:{}'.format(port))

    while running:
        try:
            conn, addr = server.accept()
            t = threading.Thread(target=handle_tcp_client, args=(conn, addr), daemon=True)
            t.start()
        except socket.timeout:
            continue
        except Exception as e:
            if not running:
                break
            log('error', 'Error en servidor TCP: {}'.format(e))


# ============================================================
# Servidor HTTP (puerto 9101) - Panel de control web
# ============================================================
def generate_dashboard():
    """Generar HTML del panel de control."""
    printers = list_printers()
    printer_options = ''
    for p in printers:
        selected = ' selected' if p['name'] == config.get('printerName', '') else ''
        name_esc = p['name'].replace('&', '&amp;').replace('"', '&quot;')
        printer_options += '<option value="{}"{}>{}</option>\n'.format(
            name_esc, selected, p['name'].replace('&', '&amp;').replace('<', '&lt;')
        )

    # Generar opciones para Generic / Text Only
    generic_printers = [p for p in printers if 'generic' in p['name'].lower() and 'text' in p['name'].lower()]
    generic_options = ''
    for p in generic_printers:
        selected = ' selected' if p['name'] == config.get('genericPrinterName', '') else ''
        name_esc = p['name'].replace('&', '&amp;').replace('"', '&quot;')
        generic_options += '<option value="{}"{}>{}</option>\n'.format(
            name_esc, selected, p['name'].replace('&', '&amp;').replace('<', '&lt;')
        )

    # Opciones de metodo
    current_method = config.get('printerMethod', 'auto')
    method_options = ''
    for val, label in [('auto', 'AUTO (intenta todos)'), ('raw_generic', 'RAW + Generic / Text Only'), ('passthrough_generic', 'PASSTHROUGH + Generic / Text Only'), ('raw_datamax', 'RAW + Driver Datamax')]:
        selected = ' selected' if val == current_method else ''
        method_options += '<option value="{}"{}>{}</option>\n'.format(val, selected, label)

    # Listar archivos .itf en upload/
    itf_files = ''
    if os.path.exists(UPLOAD_DIR):
        for fname in sorted(os.listdir(UPLOAD_DIR)):
            if fname.lower().endswith('.itf'):
                itf_files += '<option value="{}">{}</option>\n'.format(
                    fname.replace('&', '&amp;').replace('"', '&quot;'),
                    fname.replace('&', '&amp;').replace('<', '&lt;')
                )

    printer_cfg = config.get('printerName', 'Sin configurar')
    printer_cfg = printer_cfg.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

    generic_cfg = config.get('genericPrinterName', '') or 'No configurada'
    generic_cfg = generic_cfg.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

    tcp_port = config.get('tcpPort', 9100)
    http_port = config.get('httpPort', 9101)

    html = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Printer Bridge v3.4 - Solemar Alimentaria</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f4; color: #292524; padding: 20px; }
    .container { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 22px; margin-bottom: 4px; color: #1c1917; }
    .subtitle { color: #78716c; margin-bottom: 20px; font-size: 13px; }
    .card { background: white; border-radius: 10px; padding: 20px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .card h2 { font-size: 15px; margin-bottom: 14px; color: #1c1917; }
    .status { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status.online { background: #dcfce7; color: #166534; }
    .status .dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; }
    select, input[type="file"] { width: 100%; padding: 9px 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-size: 13px; background: white; cursor: pointer; margin-bottom: 10px; }
    select:focus, input:focus { outline: none; border-color: #f59e0b; }
    .btn { padding: 9px 18px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-primary { background: #f59e0b; color: white; }
    .btn-primary:hover { background: #d97706; }
    .btn-secondary { background: #e7e5e4; color: #292524; }
    .btn-secondary:hover { background: #d6d3d1; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-danger:hover { background: #dc2626; }
    .btn-group { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .info-item { padding: 10px; background: #fafaf9; border-radius: 8px; }
    .info-item .label { font-size: 11px; color: #78716c; margin-bottom: 3px; }
    .info-item .value { font-size: 16px; font-weight: 700; color: #1c1917; word-break: break-all; }
    .info-item .value.small { font-size: 13px; font-weight: 500; }
    .instructions { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; font-size: 12px; line-height: 1.6; }
    .instructions h3 { color: #92400e; margin-bottom: 6px; font-size: 13px; }
    .instructions code { background: #fef3c7; padding: 1px 5px; border-radius: 3px; font-size: 11px; }
    .msg { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-top: 10px; display: none; }
    .msg.success { display: block; background: #dcfce7; color: #166534; }
    .msg.error { display: block; background: #fef2f2; color: #991b1b; }
    .msg.info { display: block; background: #dbeafe; color: #1e40af; }
    .toast { position: fixed; bottom: 20px; right: 20px; padding: 10px 18px; border-radius: 8px; color: white; font-weight: 600; font-size: 13px; opacity: 0; transition: opacity 0.3s; z-index: 999; }
    .toast.success { background: #22c55e; }
    .toast.error { background: #ef4444; }
    .format-tabs { display: flex; gap: 4px; margin-bottom: 10px; }
    .format-tab { padding: 6px 12px; border: 1px solid #d6d3d1; border-radius: 6px; font-size: 12px; cursor: pointer; background: white; }
    .format-tab.active { background: #f59e0b; color: white; border-color: #f59e0b; }
    .diag-box { background: #1c1917; color: #a8a29e; padding: 12px; border-radius: 8px; font-family: Consolas, monospace; font-size: 11px; max-height: 400px; overflow-y: auto; display: none; white-space: pre-wrap; word-break: break-all; margin-top: 10px; }
    .section-label { font-size: 11px; color: #78716c; margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .divider { border: none; border-top: 1px solid #e7e5e4; margin: 14px 0; }
    .highlight { background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; margin-bottom: 10px; font-size: 12px; }
    .highlight strong { color: #92400e; }
    .method-indicator { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
    .method-indicator.ok { background: #22c55e; }
    .method-indicator.fail { background: #ef4444; }
    .method-indicator.unknown { background: #a8a29e; }
    @media (max-width: 600px) {
      .info-grid { grid-template-columns: 1fr; }
      .btn-group { flex-direction: column; }
      .btn { width: 100%; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Printer Bridge v3.4 (Python)</h1>
    <p class="subtitle">Solemar Alimentaria &mdash; TCP :9100 &rarr; Impresora USB Datamax Mark II</p>

    <!-- ESTADO -->
    <div class="card">
      <h2><span class="status online"><span class="dot"></span> Conectado</span></h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="label">Puerto TCP</div>
          <div class="value">""" + str(tcp_port) + """</div>
        </div>
        <div class="info-item">
          <div class="label">Impresiones</div>
          <div class="value" id="printCount">0</div>
        </div>
        <div class="info-item">
          <div class="label">Ultima impresion</div>
          <div class="value small" id="lastPrint">&mdash;</div>
        </div>
        <div class="info-item">
          <div class="label">Impresora</div>
          <div class="value small" id="currentPrinter">""" + printer_cfg + """</div>
        </div>
        <div class="info-item">
          <div class="label">Metodo</div>
          <div class="value small" id="currentMethod">""" + current_method + """</div>
        </div>
        <div class="info-item">
          <div class="label">Ultimo metodo usado</div>
          <div class="value small" id="lastMethod">&mdash;</div>
        </div>
      </div>
    </div>

    <!-- CONFIGURAR IMPRESORA -->
    <div class="card">
      <h2>Configurar Impresora</h2>
      <div class="section-label">Impresora principal (para recibir datos TCP)</div>
      <select id="printerSelect">
        <option value="">-- Seleccionar impresora --</option>
""" + printer_options + """
      </select>

      <div class="divider"></div>

      <div class="section-label">Driver Generic / Text Only (para RAW/PASSTHROUGH)</div>
      <div class="highlight">
        <strong>Importante:</strong> El driver Datamax absorbe los datos RAW. Se necesita "Generic / Text Only"
        instalado en el mismo puerto USB para enviar datos directo a la impresora.
      </div>
      <select id="genericPrinterSelect">
        <option value="">-- Seleccionar Generic / Text Only --</option>
""" + generic_options + """
      </select>

      <div class="divider"></div>

      <div class="section-label">Metodo de impresion</div>
      <select id="methodSelect">
""" + method_options + """
      </select>

      <div class="btn-group">
        <button class="btn btn-primary" onclick="saveConfig()">Guardar configuracion</button>
        <button class="btn btn-secondary" onclick="loadPrinters()">Actualizar lista</button>
      </div>
      <div class="msg" id="saveMsg"></div>
    </div>

    <!-- PROBAR PASSTHROUGH SUPPORT -->
    <div class="card">
      <h2>Diagnostico de Drivers</h2>
      <p style="font-size:12px; color:#78716c; margin-bottom:10px">
        Verifica si cada driver soporta PASSTHROUGH (ExtEscape). Necesario para determinar que metodo usar.
      </p>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="testPassthrough()">Probar PASSTHROUGH en todas</button>
      </div>
      <div class="diag-box" id="passthroughBox"></div>
    </div>

    <!-- PROBAR IMPRESION -->
    <div class="card">
      <h2>Probar Impresion</h2>
      <p style="font-size:12px; color:#78716c; margin-bottom:10px">
        Imprime una etiqueta de prueba para verificar que el bridge funciona.
      </p>
      <div class="format-tabs">
        <button class="format-tab active" onclick="setFormat('dpl', this)">DPL (Datamax)</button>
        <button class="format-tab" onclick="setFormat('zpl', this)">ZPL (Zebra)</button>
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" id="testBtn" onclick="testPrint()">Imprimir prueba</button>
      </div>
      <div class="msg" id="testMsg"></div>
    </div>

    <!-- PROBAR WRITEPRINTER RAW CON GENERIC -->
    <div class="card">
      <h2>Test: WritePrinter RAW + Generic / Text Only</h2>
      <div class="highlight">
        <strong>Test clave:</strong> Si esto funciona, es el metodo mas simple para imprimir.
        Envía datos DPL directos con datatype RAW usando el driver "Generic / Text Only".
      </div>
      <p style="font-size:12px; color:#78716c; margin-bottom:10px">
        Usa el Generic / Text Only configurado arriba. Si no hay ninguno configurado, lo busca automaticamente.
      </p>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="testWritePrinterGeneric()">Test WritePrinter RAW + Generic</button>
      </div>
      <div class="msg" id="rawGenericMsg"></div>
    </div>

    <!-- IMPRIMIR ARCHIVO .ITF -->
    <div class="card">
      <h2>Imprimir Archivo .ITF</h2>
      <p style="font-size:12px; color:#78716c; margin-bottom:10px">
        Imprime un archivo .itf directo a la impresora usando el metodo seleccionado.
        Archivos .itf en la carpeta <code>upload/</code>:
      </p>
      <select id="itfSelect">
        <option value="">-- Seleccionar archivo .itf --</option>
""" + itf_files + """
      </select>
      <div class="section-label">Metodo para archivo .itf</div>
      <div class="format-tabs">
        <button class="format-tab active" onclick="setItfMethod('raw_generic', this)">RAW + Generic</button>
        <button class="format-tab" onclick="setItfMethod('passthrough_generic', this)">PASSTHROUGH + Generic</button>
        <button class="format-tab" onclick="setItfMethod('raw_datamax', this)">RAW + Datamax</button>
        <button class="format-tab" onclick="setItfMethod('auto', this)">AUTO</button>
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" id="itfBtn" onclick="printItfFile()">Imprimir .itf</button>
      </div>
      <div class="msg" id="itfMsg"></div>
    </div>

    <!-- SUBIR ARCHIVO -->
    <div class="card">
      <h2>Subir Archivo</h2>
      <p style="font-size:12px; color:#78716c; margin-bottom:10px">
        Sube un archivo .itf para imprimirlo despues.
      </p>
      <input type="file" id="fileUpload" accept=".itf,.raw,.bin,.dpl,.zpl" />
      <div class="btn-group">
        <button class="btn btn-primary" onclick="uploadFile()">Subir archivo</button>
      </div>
      <div class="msg" id="uploadMsg"></div>
    </div>

    <!-- DIAGNOSTICO -->
    <div class="card">
      <h2>Diagnostico Completo</h2>
      <button class="btn btn-secondary" onclick="runDiagnose()">Ejecutar diagnostico</button>
      <div class="diag-box" id="diagBox"></div>
    </div>

    <!-- CONFIGURAR EN TRAZALAN -->
    <div class="card">
      <h2>Configurar en TrazAlan</h2>
      <div class="instructions">
        <h3>Para que el sistema imprima a esta PC:</h3>
        <p><strong>1.</strong> Verifica la IP de esta PC: <code>ipconfig</code></p>
        <p><strong>2.</strong> En TrazAlan ir a <strong>Configuracion &rarr; Impresoras</strong></p>
        <p><strong>3.</strong> Crear/editar impresora:</p>
        <p>&nbsp;&nbsp; Puerto: <strong>RED</strong></p>
        <p>&nbsp;&nbsp; IP: <strong>la IP de esta PC</strong> (ej: 192.168.0.113)</p>
        <p>&nbsp;&nbsp; Marca: <strong>DATAMAX</strong></p>
        <p>&nbsp;&nbsp; Modelo: <strong>Mark II</strong></p>
        <p>&nbsp;&nbsp; DPI: <strong>203</strong></p>
        <p><strong>4.</strong> Puerto TCP: <strong>""" + str(tcp_port) + """</strong></p>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    var testFormat = 'dpl';
    var itfMethod = 'raw_generic';

    function showToast(msg, type) {
      var t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast ' + type;
      t.style.opacity = '1';
      setTimeout(function() { t.style.opacity = '0'; }, 3000);
    }

    function setFormat(fmt, btn) {
      testFormat = fmt;
      var tabs = document.querySelectorAll('#testBtn').closest('.card').querySelectorAll('.format-tab');
      for (var i = 0; i < tabs.length; i++) tabs[i].className = 'format-tab';
      btn.className = 'format-tab active';
    }

    function setItfMethod(method, btn) {
      itfMethod = method;
      var tabs = document.querySelectorAll('#itfBtn').closest('.card').querySelectorAll('.format-tab');
      for (var i = 0; i < tabs.length; i++) tabs[i].className = 'format-tab';
      btn.className = 'format-tab active';
    }

    function showMsg(id, text, type) {
      var el = document.getElementById(id);
      el.className = 'msg ' + type;
      el.textContent = text;
      el.style.display = 'block';
    }

    function hideMsg(id) {
      document.getElementById(id).style.display = 'none';
    }

    function loadPrinters() {
      fetch('/api/printers').then(function(r) { return r.json(); }).then(function(data) {
        var sel = document.getElementById('printerSelect');
        sel.innerHTML = '<option value="">-- Seleccionar impresora --</option>';
        var gsel = document.getElementById('genericPrinterSelect');
        gsel.innerHTML = '<option value="">-- Seleccionar Generic / Text Only --</option>';

        data.printers.forEach(function(p) {
          var opt = document.createElement('option');
          opt.value = p.name;
          opt.textContent = p.name + ' (' + (p.port || '?') + ')';
          if (p.name === data.configured) opt.selected = true;
          sel.appendChild(opt);

          // Detectar Generic / Text Only
          if (p.name.toLowerCase().indexOf('generic') !== -1 && p.name.toLowerCase().indexOf('text') !== -1) {
            var gopt = document.createElement('option');
            gopt.value = p.name;
            gopt.textContent = p.name + ' (' + (p.port || '?') + ')';
            if (p.name === data.genericPrinter) gopt.selected = true;
            gsel.appendChild(gopt);
          }
        });

        // Actualizar lista de .itf
        refreshItfFiles();
      }).catch(function() {
        showToast('Error al cargar impresoras', 'error');
      });
    }

    function refreshItfFiles() {
      fetch('/api/files').then(function(r) { return r.json(); }).then(function(data) {
        var sel = document.getElementById('itfSelect');
        sel.innerHTML = '<option value="">-- Seleccionar archivo .itf --</option>';
        (data.files || []).forEach(function(f) {
          var opt = document.createElement('option');
          opt.value = f.name;
          opt.textContent = f.name + ' (' + (f.size || '?') + ' bytes)';
          sel.appendChild(opt);
        });
      }).catch(function() {});
    }

    function saveConfig() {
      var printerName = document.getElementById('printerSelect').value;
      var genericPrinterName = document.getElementById('genericPrinterSelect').value;
      var printerMethod = document.getElementById('methodSelect').value;

      fetch('/api/config', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          printerName: printerName,
          genericPrinterName: genericPrinterName,
          printerMethod: printerMethod
        })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.success) {
          document.getElementById('currentPrinter').textContent = printerName || 'Sin configurar';
          document.getElementById('currentMethod').textContent = printerMethod;
          showToast('Configuracion guardada', 'success');
          showMsg('saveMsg', 'Guardado OK', 'success');
        } else {
          showToast('Error al guardar', 'error');
          showMsg('saveMsg', 'Error: ' + (data.error || '?'), 'error');
        }
      }).catch(function(e) {
        showToast('Error de conexion', 'error');
      });
    }

    function testPrint() {
      var msgBox = document.getElementById('testMsg');
      var btn = document.getElementById('testBtn');
      hideMsg('testMsg');
      var printerName = document.getElementById('currentPrinter').textContent;
      if (!printerName || printerName === 'Sin configurar') {
        showToast('Configura una impresora primero', 'error');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Imprimiendo...';
      fetch('/api/test', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({format: testFormat})
      }).then(function(r) { return r.json(); }).then(function(data) {
        btn.disabled = false;
        btn.textContent = 'Imprimir prueba';
        if (data.success) {
          showToast('Prueba enviada OK', 'success');
          showMsg('testMsg', 'OK via [' + (data.method || '?') + '] - ' + (data.bytes_written || '?') + ' bytes', 'success');
        } else {
          showToast('Error en la prueba', 'error');
          showMsg('testMsg', 'Error via [' + (data.method || '?') + ']: ' + (data.error || 'Desconocido'), 'error');
        }
      }).catch(function(e) {
        btn.disabled = false;
        btn.textContent = 'Imprimir prueba';
        showToast('Error de conexion', 'error');
        showMsg('testMsg', 'Error: ' + e.message, 'error');
      });
    }

    function testPassthrough() {
      var box = document.getElementById('passthroughBox');
      box.style.display = 'block';
      box.textContent = 'Probando PASSTHROUGH en todos los drivers...';
      fetch('/api/passthrough-test').then(function(r) { return r.json(); }).then(function(data) {
        var lines = '=== RESULTADO PASSTHROUGH TEST ===\\n\\n';
        if (data.results) {
          data.results.forEach(function(r) {
            var icon = r.supported ? '[SI]' : '[NO]';
            var detail = 'ret=' + (r.escape_result !== undefined ? r.escape_result : '?');
            if (r.error) detail += ' err=' + r.error;
            lines += icon + ' ' + r.printer + ' - ' + detail + '\\n';
          });
        }
        if (data.recommendation) {
          lines += '\\n=== RECOMENDACION ===\\n' + data.recommendation + '\\n';
        }
        box.textContent = lines;
      }).catch(function(e) {
        box.textContent = 'Error: ' + e.message;
      });
    }

    function testWritePrinterGeneric() {
      var msgBox = document.getElementById('rawGenericMsg');
      hideMsg('rawGenericMsg');
      fetch('/api/test-raw-generic', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({format: 'dpl'})
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.success) {
          showToast('WritePrinter RAW + Generic OK!', 'success');
          showMsg('rawGenericMsg', 'OK! ' + (data.bytes_written || '?') + ' bytes escritos via WritePrinter RAW -> ' + (data.printer_used || '?'), 'success');
        } else {
          showToast('WritePrinter RAW + Generic fallo', 'error');
          showMsg('rawGenericMsg', 'Error: ' + (data.error || 'Desconocido'), 'error');
        }
      }).catch(function(e) {
        showToast('Error de conexion', 'error');
        showMsg('rawGenericMsg', 'Error: ' + e.message, 'error');
      });
    }

    function printItfFile() {
      var msgBox = document.getElementById('itfMsg');
      var btn = document.getElementById('itfBtn');
      var filename = document.getElementById('itfSelect').value;
      if (!filename) {
        showToast('Selecciona un archivo .itf primero', 'error');
        return;
      }
      hideMsg('itfMsg');
      btn.disabled = true;
      btn.textContent = 'Imprimiendo...';
      fetch('/api/print-file', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({filename: filename, method: itfMethod})
      }).then(function(r) { return r.json(); }).then(function(data) {
        btn.disabled = false;
        btn.textContent = 'Imprimir .itf';
        if (data.success) {
          showToast('Archivo impreso OK!', 'success');
          showMsg('itfMsg', 'OK via [' + (data.method || '?') + '] - ' + (data.bytes_written || '?') + ' bytes de ' + (data.file_size || '?') + ' bytes del archivo', 'success');
        } else {
          showToast('Error imprimiendo archivo', 'error');
          showMsg('itfMsg', 'Error via [' + (data.method || '?') + ']: ' + (data.error || 'Desconocido'), 'error');
        }
      }).catch(function(e) {
        btn.disabled = false;
        btn.textContent = 'Imprimir .itf';
        showToast('Error de conexion', 'error');
        showMsg('itfMsg', 'Error: ' + e.message, 'error');
      });
    }

    function uploadFile() {
      var input = document.getElementById('fileUpload');
      var file = input.files[0];
      if (!file) {
        showToast('Selecciona un archivo primero', 'error');
        return;
      }
      var formData = new FormData();
      formData.append('file', file);

      fetch('/api/upload', {
        method: 'POST',
        body: formData
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.success) {
          showToast('Archivo subido: ' + (data.filename || '?'), 'success');
          showMsg('uploadMsg', 'Subido OK: ' + (data.filename || '?') + ' (' + (data.size || '?') + ' bytes)', 'success');
          refreshItfFiles();
          // Seleccionar el archivo recien subido
          var sel = document.getElementById('itfSelect');
          for (var i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === data.filename) {
              sel.selectedIndex = i;
              break;
            }
          }
        } else {
          showToast('Error subiendo archivo', 'error');
          showMsg('uploadMsg', 'Error: ' + (data.error || '?'), 'error');
        }
      }).catch(function(e) {
        showToast('Error de conexion', 'error');
        showMsg('uploadMsg', 'Error: ' + e.message, 'error');
      });
    }

    function refreshStats() {
      fetch('/api/config').then(function(r) { return r.json(); }).then(function(data) {
        document.getElementById('printCount').textContent = data.printCount || 0;
        document.getElementById('lastPrint').textContent = data.lastPrintTime || '-';
        document.getElementById('currentPrinter').textContent = data.printerName || 'Sin configurar';
        document.getElementById('currentMethod').textContent = data.printerMethod || 'auto';
        document.getElementById('lastMethod').textContent = data.lastPrintMethod || '-';
      }).catch(function() {});
    }

    function runDiagnose() {
      var box = document.getElementById('diagBox');
      box.style.display = 'block';
      box.textContent = 'Ejecutando diagnostico...';
      fetch('/api/diagnose').then(function(r) { return r.json(); }).then(function(data) {
        box.textContent = JSON.stringify(data, null, 2);
      }).catch(function(e) {
        box.textContent = 'Error: ' + e.message;
      });
    }

    loadPrinters();
    setInterval(refreshStats, 5000);
  </script>
</body>
</html>"""
    return html


class DashboardHandler(BaseHTTPRequestHandler):
    """HTTP request handler para el panel de control."""

    def log_message(self, format, *args):
        """Silenciar logs de HTTP."""
        pass

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        try:
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
        except (ConnectionAbortedError, BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if self.path == '/api/printers':
            printers = list_printers()
            self.send_json({
                'printers': printers,
                'configured': config.get('printerName', ''),
                'genericPrinter': config.get('genericPrinterName', '')
            })

        elif self.path == '/api/files':
            """Listar archivos en upload/"""
            files = []
            if os.path.exists(UPLOAD_DIR):
                for fname in sorted(os.listdir(UPLOAD_DIR)):
                    fpath = os.path.join(UPLOAD_DIR, fname)
                    if os.path.isfile(fpath):
                        files.append({
                            'name': fname,
                            'size': os.path.getsize(fpath)
                        })
            self.send_json({'files': files})

        elif self.path == '/api/config':
            self.send_json({
                'printerName': config.get('printerName', ''),
                'genericPrinterName': config.get('genericPrinterName', ''),
                'printerMethod': config.get('printerMethod', 'auto'),
                'tcpPort': config.get('tcpPort', 9100),
                'httpPort': config.get('httpPort', 9101),
                'logLevel': config.get('logLevel', 'info'),
                'printCount': print_count,
                'lastPrintTime': last_print_time,
                'lastPrintMethod': last_print_method,
                'status': 'running',
                'python_version': sys.version,
                'platform': sys.platform
            })

        elif self.path == '/api/diagnose':
            win32print = try_import_win32print()
            pname = config.get('printerName', '')
            gname = config.get('genericPrinterName', '')

            # Probar PASSTHROUGH en ambas impresoras
            passthrough_results = {}
            for printer in [pname, gname]:
                if printer:
                    passthrough_results[printer] = test_passthrough_support(printer)

            self.send_json({
                'python_version': sys.version,
                'python_path': sys.executable,
                'platform': sys.platform,
                'pywin32_installed': win32print is not None,
                'config_path': CONFIG_PATH,
                'config_exists': os.path.exists(CONFIG_PATH),
                'temp_dir': TEMP_DIR,
                'temp_dir_exists': os.path.exists(TEMP_DIR),
                'upload_dir': UPLOAD_DIR,
                'upload_dir_exists': os.path.exists(UPLOAD_DIR),
                'printer_name': pname,
                'printer_port': get_printer_port(pname) if pname else '',
                'generic_printer_name': gname,
                'generic_printer_port': get_printer_port(gname) if gname else '',
                'printer_method': config.get('printerMethod', 'auto'),
                'passthrough_tests': passthrough_results,
                'printers': list_printers(),
                'print_count': print_count,
                'last_print_time': last_print_time,
                'last_print_method': last_print_method,
                'last_print_error': last_print_error,
                'current_dir': os.path.dirname(os.path.abspath(__file__))
            })

        elif self.path == '/api/passthrough-test':
            """Probar PASSTHROUGH en todas las impresoras detectadas."""
            printers = list_printers()
            results = []
            for p in printers:
                name = p['name']
                # Solo probar impresoras locales o USB
                if 'generic' in name.lower() or 'datamax' in name.lower() or 'text' in name.lower() or name == config.get('printerName', ''):
                    result = test_passthrough_support(name)
                    result['port'] = p.get('port', '')
                    results.append(result)

            # Recomendacion
            recommendation = ''
            generic_supported = any(r.get('supported') for r in results if 'generic' in r.get('printer', '').lower())
            datamax_result = next((r for r in results if 'datamax' in r.get('printer', '').lower()), None)

            if generic_supported:
                recommendation = 'Usar "Generic / Text Only" con WritePrinter RAW (metodo mas simple).'
            elif datamax_result and datamax_result.get('supported'):
                recommendation = 'El driver Datamax soporta PASSTHROUGH (inesperado). Usar PASSTHROUGH directo.'
            else:
                recommendation = 'Ningun driver soporta PASSTHROUGH. Intentar WritePrinter RAW con Generic / Text Only de todos modos (RAW puede funcionar sin PASSTHROUGH).'

            self.send_json({
                'results': results,
                'recommendation': recommendation
            })

        else:
            # Dashboard HTML
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            try:
                html = generate_dashboard()
                self.wfile.write(html.encode('utf-8'))
            except (ConnectionAbortedError, BrokenPipeError, ConnectionResetError):
                pass

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else b''

        if self.path == '/api/config':
            try:
                new_cfg = json.loads(body.decode('utf-8'))
                global config
                if 'printerName' in new_cfg:
                    config['printerName'] = new_cfg['printerName']
                if 'genericPrinterName' in new_cfg:
                    config['genericPrinterName'] = new_cfg['genericPrinterName']
                if 'printerMethod' in new_cfg:
                    config['printerMethod'] = new_cfg['printerMethod']
                if 'tcpPort' in new_cfg:
                    config['tcpPort'] = int(new_cfg['tcpPort'])
                if 'httpPort' in new_cfg:
                    config['httpPort'] = int(new_cfg['httpPort'])
                if 'logLevel' in new_cfg:
                    config['logLevel'] = new_cfg['logLevel']
                save_config(config)
                self.send_json({'success': True, 'config': config})
            except Exception as e:
                self.send_json({'success': False, 'error': str(e)}, 400)

        elif self.path == '/api/test':
            """Imprimir etiqueta de prueba con el metodo configurado."""
            printer_name = config.get('printerName', '')
            if not printer_name:
                self.send_json({'success': False, 'error': 'No hay impresora configurada'}, 400)
                return

            try:
                req = json.loads(body.decode('utf-8')) if body else {}
                fmt = req.get('format', 'dpl')
            except:
                fmt = 'dpl'

            now = datetime.now().strftime('%d/%m/%Y %H:%M:%S')

            if fmt == 'zpl':
                # Etiqueta de prueba ZPL (compatible Zebra)
                test_data = (
                    "^XA\n"
                    "^FO50,30^A0N,40,40^FD** PRUEBA **^FS\n"
                    "^FO50,80^A0N,30,30^FDPrinter Bridge v3.4^FS\n"
                    "^FO50,120^A0N,20,20^FD{fecha}^FS\n"
                    "^FO50,150^A0N,20,20^FDSolemar Alimentaria^FS\n"
                    "^FO50,180^A0N,25,25^FDDatamax Mark II^FS\n"
                    "^FO50,220^BY3^BCN,60,Y,N,N^FDTEST-BRIDGE^FS\n"
                    "^XZ"
                ).format(fecha=now)
            else:
                # Etiqueta de prueba DPL con STX/ETX
                test_data = (
                    "\x02"          # STX - inicio
                    "n\n"
                    "M1084\n"
                    "O0220\n"
                    "SO\n"
                    "d\n"
                    "L\n"
                    "D11\n"
                    "PO\n"
                    "pG\n"
                    "SO\n"
                    "A2\n"
                    "1e8406900410065Ccb\n"
                    "ySE1\n"
                    "1911A1200220110SOLEMAR ALIMENTARIA\n"
                    "1911A1200550110** PRUEBA **\n"
                    "1911A1200880110Printer Bridge v3.4\n"
                    "1911A1201210110Datamax Mark II\n"
                    "1911A1201540110" + now + "\n"
                    "Q0001\n"
                    "\x03"          # ETX - fin
                    "E\n"
                )

            result = print_raw(printer_name, test_data)
            self.send_json(result)

        elif self.path == '/api/test-raw-generic':
            """Test WritePrinter RAW con Generic / Text Only (sin PASSTHROUGH)."""
            try:
                req = json.loads(body.decode('utf-8')) if body else {}
                fmt = req.get('format', 'dpl')
            except:
                fmt = 'dpl'

            now = datetime.now().strftime('%d/%m/%Y %H:%M:%S')

            # DPL de prueba
            test_data = (
                "\x02"
                "n\n"
                "M1084\n"
                "O0220\n"
                "SO\n"
                "d\n"
                "L\n"
                "D11\n"
                "PO\n"
                "pG\n"
                "SO\n"
                "A2\n"
                "1e8406900410065Ccb\n"
                "ySE1\n"
                "1911A1200220110TEST RAW GENERIC\n"
                "1911A1200550110WritePrinter RAW\n"
                "1911A1200880110Generic-Text-Only\n"
                "1911A1201210110Printer Bridge v3.4\n"
                "1911A1201540110" + now + "\n"
                "Q0001\n"
                "\x03"
                "E\n"
            )

            # Buscar Generic / Text Only
            target = config.get('genericPrinterName', '')
            if not target:
                printers = list_printers()
                for p in printers:
                    if 'generic' in p['name'].lower() and 'text' in p['name'].lower():
                        target = p['name']
                        break

            if not target:
                self.send_json({
                    'success': False,
                    'method': 'WritePrinter RAW + Generic',
                    'error': 'No se encontro "Generic / Text Only". Instalalo en Windows y configuralo arriba.'
                })
                return

            result = print_writeprinter_raw(target, test_data)
            result['printer_used'] = target
            result['test'] = 'WritePrinter RAW + Generic / Text Only'
            self.send_json(result)

        elif self.path == '/api/print-file':
            """Imprimir un archivo .itf de la carpeta upload/."""
            try:
                req = json.loads(body.decode('utf-8')) if body else {}
                filename = req.get('filename', '')
                method = req.get('method', None)
            except:
                self.send_json({'success': False, 'error': 'JSON invalido'}, 400)
                return

            if not filename:
                self.send_json({'success': False, 'error': 'No se especifico archivo'}, 400)
                return

            # Seguridad: solo archivos en upload/
            filepath = os.path.join(UPLOAD_DIR, os.path.basename(filename))
            if not os.path.exists(filepath):
                self.send_json({'success': False, 'error': 'Archivo no encontrado: {}'.format(filename)}, 404)
                return

            # Usar la impresora configurada
            printer_name = config.get('printerName', '')
            if not printer_name:
                self.send_json({'success': False, 'error': 'No hay impresora configurada'}, 400)
                return

            result = print_file(printer_name, filepath, method=method)
            self.send_json(result)

        elif self.path == '/api/upload':
            """Subir un archivo a la carpeta upload/."""
            content_type = self.headers.get('Content-Type', '')

            if 'multipart/form-data' in content_type:
                # Parsear multipart manualmente (Python 3.8 sin cgi.FieldStorage)
                boundary = content_type.split('boundary=')[1] if 'boundary=' in content_type else ''
                if boundary:
                    boundary = boundary.strip('"')
                    parts = body.split(('--' + boundary).encode())
                    for part in parts[1:]:  # Skip preamble
                        if part.startswith(b'--'):  # End boundary
                            break
                        # Find headers
                        header_end = part.find(b'\r\n\r\n')
                        if header_end > 0:
                            headers = part[:header_end].decode('utf-8', errors='replace')
                            file_data = part[header_end + 4:]
                            # Remove trailing \r\n
                            if file_data.endswith(b'\r\n'):
                                file_data = file_data[:-2]

                            # Extract filename
                            import re
                            fname_match = re.search(r'filename="([^"]+)"', headers)
                            if fname_match:
                                fname = fname_match.group(1)
                                # Safe filename
                                safe_fname = os.path.basename(fname)
                                save_path = os.path.join(UPLOAD_DIR, safe_fname)

                                with open(save_path, 'wb') as f:
                                    f.write(file_data)

                                self.send_json({
                                    'success': True,
                                    'filename': safe_fname,
                                    'size': len(file_data),
                                    'path': save_path
                                })
                                return

                self.send_json({'success': False, 'error': 'No se pudo parsear el archivo'}, 400)
            else:
                self.send_json({'success': False, 'error': 'Content-Type incorrecto'}, 400)

        else:
            self.send_json({'error': 'Endpoint no encontrado'}, 404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


def start_http_server():
    """Iniciar servidor HTTP para el panel de control."""
    port = config.get('httpPort', 9101)
    server = HTTPServer(('0.0.0.0', port), DashboardHandler)
    log('info', 'Panel web en http://localhost:{}'.format(port))
    try:
        server.serve_forever()
    except:
        pass


# ============================================================
# Obtener IP local
# ============================================================
def get_local_ip():
    """Obtener la IP local de esta maquina."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return '127.0.0.1'


# ============================================================
# Inicio
# ============================================================
running = True


def main():
    """Funcion principal."""
    # Verificar Python 3.8+
    if sys.version_info < (3, 8):
        print('')
        print('ERROR: Se requiere Python 3.8 o superior.')
        print('Version actual: {}'.format(sys.version))
        print('')
        print('Para Windows 7, descarga Python 3.8.10 desde:')
        print('https://www.python.org/ftp/python/3.8.10/python-3.8.10.exe')
        print('')
        sys.exit(1)

    # Verificar pywin32
    win32print = try_import_win32print()
    if not win32print:
        print('')
        print('ADVERTENCIA: pywin32 no esta instalado.')
        print('Sin pywin32 no se puede imprimir.')
        print('')
        print('Para instalar:')
        print('  pip install pywin32')
        print('')
        print('O ejecuta install.bat')
        print('')

    # Mostrar info de metodos de impresion
    method = config.get('printerMethod', 'auto')
    generic_name = config.get('genericPrinterName', '')

    local_ip = get_local_ip()
    tcp_port = config.get('tcpPort', 9100)
    http_port = config.get('httpPort', 9101)
    printer_name = config.get('printerName', '(sin configurar)')

    print('')
    print('========================================================')
    print('  PRINTER BRIDGE v3.4 (Python) - Solemar Alimentaria')
    print('========================================================')
    print('  Python:    {}'.format(sys.version.split()[0]))
    print('  pywin32:   {}'.format('OK' if win32print else 'NO INSTALADO'))
    print('  TCP:       {}:{}'.format(local_ip, tcp_port))
    print('  Panel Web: http://{}:{}'.format(local_ip, http_port))
    print('  Impresora: {}'.format(printer_name))
    print('  Metodo:    {}'.format(method))
    if generic_name:
        print('  Generic:   {}'.format(generic_name))
    print('========================================================')
    print('')
    print('  Metodos disponibles:')
    print('    AUTO           - intenta todos en orden')
    print('    RAW+Generic    - WritePrinter RAW con Generic/Text Only')
    print('    PASSTHROUGH    - ExtEscape PASSTHROUGH con Generic/Text Only')
    print('    RAW+Datamax    - WritePrinter RAW con driver Datamax')
    print('')
    print('Abri http://localhost:{} en tu navegador para configurar'.format(http_port))
    print('')

    # Iniciar HTTP server en un thread separado
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()

    # Iniciar TCP server en el hilo principal
    start_tcp_server()


if __name__ == '__main__':
    main()
