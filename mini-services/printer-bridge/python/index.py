# -*- coding: utf-8 -*-
"""
Printer Bridge v3.0 - Solemar Alimentaria
==========================================
Puente TCP -> Impresora USB para Windows 7
Compatible con Python 3.8.10 (ultima version para Win7)

Arquitectura:
  Sistema TrazAlan (Next.js) -> TCP/IP :9100 -> Este bridge -> win32print -> USB Datamax Mark II

Formatos soportados:
  - ZPL (Zebra Programming Language)
  - DPL (Datamax Programming Language)
  - Cualquier dato RAW enviado por TCP

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
TEMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp')

DEFAULT_CONFIG = {
    'printerName': '',        # Nombre exacto de la impresora en Windows
    'tcpPort': 9100,          # Puerto TCP para recibir datos (estandar impresoras)
    'httpPort': 9101,         # Puerto HTTP para panel de control
    'logLevel': 'info',       # info, debug, error
    'autoStart': True,
    'copyCount': 1            # Cantidad de copias por defecto
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

# Crear directorio temp si no existe
if not os.path.exists(TEMP_DIR):
    try:
        os.makedirs(TEMP_DIR)
    except:
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


def print_raw(printer_name, data):
    """
    Imprimir datos en la impresora Datamax via archivo .itf temporal.

    La Datamax M-4206 usa archivos .itf (Intelligent Tag Format) que contienen
    comandos DPL. Se escribe un archivo .itf temporal y se imprime usando el
    driver de Windows (metodo del sistema viejo de trazabilidad).

    Args:
        printer_name: Nombre exacto de la impresora en Windows
        data: bytes o str con los datos (DPL) a imprimir

    Returns:
        dict con {success: bool, bytes_written: int, error: str, method: str}
    """
    import uuid

    if isinstance(data, str):
        data = data.encode('latin-1', errors='replace')

    if len(data) == 0:
        return {'success': False, 'error': 'Datos vacios'}

    # Generar archivo .itf temporal
    job_id = uuid.uuid4().hex[:8]
    filename = 'print-job-{}.itf'.format(job_id)
    filepath = os.path.join(TEMP_DIR, filename)

    try:
        with open(filepath, 'wb') as f:
            f.write(data)
        log('debug', 'Archivo ITF creado: {} ({} bytes)'.format(filepath, len(data)))
    except Exception as e:
        log('error', 'Error creando archivo ITF: {}'.format(e))
        return {'success': False, 'error': 'Error creando archivo temporal: {}'.format(e)}

    # === METODO 1: os.startfile (usa la asociacion de .itf con el driver) ===
    try:
        os.startfile(filepath, 'print')
        log('info', 'Impresion OK (startfile) - {} bytes -> "{}"'.format(len(data), printer_name))
        return {'success': True, 'bytes_written': len(data), 'method': 'startfile'}
    except Exception as e:
        log('debug', 'startfile fallo: {}'.format(e))

    # === METODO 2: comando PRINT de Windows ===
    try:
        result = subprocess.run(
            ['print', '/D:"{}"'.format(printer_name), filepath],
            shell=True, capture_output=True, timeout=30
        )
        if result.returncode == 0:
            log('info', 'Impresion OK (print cmd) - {} bytes -> "{}"'.format(len(data), printer_name))
            return {'success': True, 'bytes_written': len(data), 'method': 'print_cmd'}
        else:
            log('debug', 'print cmd retorno {}: {}'.format(result.returncode, result.stderr.decode('mbcs', errors='replace')))
    except Exception as e:
        log('debug', 'print cmd fallo: {}'.format(e))

    # === METODO 3: PowerShell Out-Printer ===
    try:
        ps_cmd = 'Get-Content -Path "{}" -Raw | Out-Printer -Name "{}"'.format(filepath, printer_name)
        result = subprocess.run(
            ['powershell', '-NoProfile', '-Command', ps_cmd],
            capture_output=True, timeout=30
        )
        if result.returncode == 0:
            log('info', 'Impresion OK (PowerShell) - {} bytes -> "{}"'.format(len(data), printer_name))
            return {'success': True, 'bytes_written': len(data), 'method': 'powershell'}
        else:
            log('debug', 'PowerShell retorno {}'.format(result.returncode))
    except Exception as e:
        log('debug', 'PowerShell fallo: {}'.format(e))

    # === METODO 4: win32print RAW (fallback directo) ===
    win32print = try_import_win32print()
    if win32print:
        try:
            hPrinter = win32print.OpenPrinter(printer_name)
            try:
                docInfo = ['PrinterBridge', None, 'RAW']
                win32print.StartDocPrinter(hPrinter, 1, docInfo)
                try:
                    win32print.StartPagePrinter(hPrinter)
                    try:
                        with open(filepath, 'rb') as f:
                            file_data = f.read()
                        written = win32print.WritePrinter(hPrinter, file_data)
                        win32print.EndPagePrinter(hPrinter)
                        win32print.EndDocPrinter(hPrinter)
                        log('info', 'Impresion OK (win32print RAW) - {} bytes -> "{}"'.format(written, printer_name))
                        return {'success': True, 'bytes_written': written, 'method': 'win32print'}
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
            log('debug', 'win32print RAW fallo: {}'.format(e))

    # Ningun metodo funciono
    log('error', 'Todos los metodos de impresion fallaron')
    return {
        'success': False,
        'error': 'No se pudo imprimir. Verifica que el driver Datamax este instalado y la impresora encendida.'
    }


# ============================================================
# Servidor TCP (puerto 9100) - Recibe ZPL/DPL del sistema
# ============================================================
print_count = 0
last_print_time = ''
last_print_error = ''
lock = threading.Lock()


def handle_tcp_client(conn, addr):
    """Manejar una conexion TCP entrante."""
    global print_count, last_print_time, last_print_error

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

        if result['success']:
            log('info', 'Impresion #{} exitosa ({} bytes escritos)'.format(print_count, result.get('bytes_written', '?')))
            last_print_error = ''
        else:
            log('error', 'Impresion #{} fallida: {}'.format(print_count, result.get('error', '?')))
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

    printer_cfg = config.get('printerName', 'Sin configurar')
    printer_cfg = printer_cfg.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

    tcp_port = config.get('tcpPort', 9100)
    http_port = config.get('httpPort', 9101)

    html = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Printer Bridge v3.0 - Solemar Alimentaria</title>
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
    select { width: 100%; padding: 9px 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-size: 13px; background: white; cursor: pointer; margin-bottom: 10px; }
    select:focus { outline: none; border-color: #f59e0b; }
    .btn { padding: 9px 18px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-primary { background: #f59e0b; color: white; }
    .btn-primary:hover { background: #d97706; }
    .btn-secondary { background: #e7e5e4; color: #292524; }
    .btn-secondary:hover { background: #d6d3d1; }
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
    .toast { position: fixed; bottom: 20px; right: 20px; padding: 10px 18px; border-radius: 8px; color: white; font-weight: 600; font-size: 13px; opacity: 0; transition: opacity 0.3s; z-index: 999; }
    .toast.success { background: #22c55e; }
    .toast.error { background: #ef4444; }
    .format-tabs { display: flex; gap: 4px; margin-bottom: 10px; }
    .format-tab { padding: 6px 12px; border: 1px solid #d6d3d1; border-radius: 6px; font-size: 12px; cursor: pointer; background: white; }
    .format-tab.active { background: #f59e0b; color: white; border-color: #f59e0b; }
    .diag-box { background: #1c1917; color: #a8a29e; padding: 12px; border-radius: 8px; font-family: Consolas, monospace; font-size: 11px; max-height: 300px; overflow-y: auto; display: none; white-space: pre-wrap; word-break: break-all; margin-top: 10px; }
    @media (max-width: 600px) {
      .info-grid { grid-template-columns: 1fr; }
      .btn-group { flex-direction: column; }
      .btn { width: 100%; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Printer Bridge v3.0 (Python)</h1>
    <p class="subtitle">Solemar Alimentaria &mdash; TCP :9100 &rarr; Impresora USB Datamax Mark II</p>

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
      </div>
    </div>

    <div class="card">
      <h2>Configurar Impresora</h2>
      <select id="printerSelect">
        <option value="">-- Seleccionar impresora --</option>
""" + printer_options + """
      </select>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="savePrinter()">Guardar</button>
        <button class="btn btn-secondary" onclick="loadPrinters()">Actualizar lista</button>
      </div>
      <div class="msg" id="saveMsg"></div>
    </div>

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

    <div class="card">
      <h2>Diagnostico</h2>
      <button class="btn btn-secondary" onclick="runDiagnose()">Ejecutar diagnostico</button>
      <div class="diag-box" id="diagBox"></div>
    </div>

    <div class="card">
      <h2>Configurar en TrazAlan</h2>
      <div class="instructions">
        <h3>Para que el sistema imprima a esta PC:</h3>
        <p><strong>1.</strong> Verifica la IP de esta PC: <code>ipconfig</code></p>
        <p><strong>2.</strong> En TrazAlan ir a <strong>Configuracion &rarr; Impresoras</strong></p>
        <p><strong>3.</strong> Crear/editar impresora:</p>
        <p>&nbsp;&nbsp; Puerto: <strong>RED</strong></p>
        <p>&nbsp;&nbsp; IP: <strong>la IP de esta PC</strong> (ej: 192.168.1.50)</p>
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

    function showToast(msg, type) {
      var t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast ' + type;
      t.style.opacity = '1';
      setTimeout(function() { t.style.opacity = '0'; }, 3000);
    }

    function setFormat(fmt, btn) {
      testFormat = fmt;
      var tabs = document.querySelectorAll('.format-tab');
      for (var i = 0; i < tabs.length; i++) tabs[i].className = 'format-tab';
      btn.className = 'format-tab active';
    }

    function loadPrinters() {
      fetch('/api/printers').then(function(r) { return r.json(); }).then(function(data) {
        var sel = document.getElementById('printerSelect');
        sel.innerHTML = '<option value="">-- Seleccionar impresora --</option>';
        data.printers.forEach(function(p) {
          var opt = document.createElement('option');
          opt.value = p.name;
          opt.textContent = p.name;
          if (p.name === data.configured) opt.selected = true;
          sel.appendChild(opt);
        });
      }).catch(function() {
        showToast('Error al cargar impresoras', 'error');
      });
    }

    function savePrinter() {
      var name = document.getElementById('printerSelect').value;
      if (!name) { showToast('Selecciona una impresora', 'error'); return; }
      fetch('/api/config', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({printerName: name})
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.success) {
          document.getElementById('currentPrinter').textContent = name;
          showToast('Impresora configurada: ' + name, 'success');
          document.getElementById('saveMsg').className = 'msg success';
          document.getElementById('saveMsg').textContent = 'Guardado OK';
        } else {
          showToast('Error al guardar', 'error');
        }
      });
    }

    function testPrint() {
      var msgBox = document.getElementById('testMsg');
      var btn = document.getElementById('testBtn');
      msgBox.style.display = 'none';
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
          msgBox.className = 'msg success';
          msgBox.textContent = 'Etiqueta enviada (' + (data.bytes_written || '?') + ' bytes)';
        } else {
          showToast('Error en la prueba', 'error');
          msgBox.className = 'msg error';
          msgBox.textContent = 'Error: ' + (data.error || 'Desconocido');
        }
      }).catch(function(e) {
        btn.disabled = false;
        btn.textContent = 'Imprimir prueba';
        showToast('Error de conexion', 'error');
        msgBox.className = 'msg error';
        msgBox.textContent = 'Error: ' + e.message;
      });
    }

    function refreshStats() {
      fetch('/api/config').then(function(r) { return r.json(); }).then(function(data) {
        document.getElementById('printCount').textContent = data.printCount || 0;
        document.getElementById('lastPrint').textContent = data.lastPrintTime || '-';
        document.getElementById('currentPrinter').textContent = data.printerName || 'Sin configurar';
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
                'configured': config.get('printerName', '')
            })
        elif self.path == '/api/config':
            self.send_json({
                'printerName': config.get('printerName', ''),
                'tcpPort': config.get('tcpPort', 9100),
                'httpPort': config.get('httpPort', 9101),
                'logLevel': config.get('logLevel', 'info'),
                'printCount': print_count,
                'lastPrintTime': last_print_time,
                'status': 'running',
                'python_version': sys.version,
                'platform': sys.platform
            })
        elif self.path == '/api/diagnose':
            win32print = try_import_win32print()
            pname = config.get('printerName', '')
            self.send_json({
                'python_version': sys.version,
                'python_path': sys.executable,
                'platform': sys.platform,
                'pywin32_installed': win32print is not None,
                'config_path': CONFIG_PATH,
                'config_exists': os.path.exists(CONFIG_PATH),
                'temp_dir': TEMP_DIR,
                'temp_dir_exists': os.path.exists(TEMP_DIR),
                'printer_name': pname,
                'printer_port': get_printer_port(pname) if pname else '',
                'printers': list_printers(),
                'print_count': print_count,
                'last_print_time': last_print_time,
                'last_print_error': last_print_error,
                'current_dir': os.path.dirname(os.path.abspath(__file__))
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
                # El navegador cerro la conexion antes de terminar de enviar
                # (error comun, no critico - ignorar silenciosamente)
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
                    "^FO50,80^A0N,30,30^FDPrinter Bridge v3.0^FS\n"
                    "^FO50,120^A0N,20,20^FD{fecha}^FS\n"
                    "^FO50,150^A0N,20,20^FDSolemar Alimentaria^FS\n"
                    "^FO50,180^A0N,25,25^FDDatamax Mark II^FS\n"
                    "^FO50,220^BY3^BCN,60,Y,N,N^FDTEST-BRIDGE^FS\n"
                    "^XZ"
                ).format(fecha=now)
            else:
                # Etiqueta de prueba DPL - Formato exacto del sistema viejo de trazabilidad
                # Basado en ANIMAL INDIVIDUAL.itf comprobado que funciona
                test_data = (
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
                    "1911A1200880110Printer Bridge v3.0\n"
                    "1911A1201210110Datamax Mark II\n"
                    "1911A1201540110" + now + "\n"
                    "Q0001\n"
                    "E\n"
                )

            result = print_raw(printer_name, test_data)
            self.send_json(result)

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

    local_ip = get_local_ip()
    tcp_port = config.get('tcpPort', 9100)
    http_port = config.get('httpPort', 9101)
    printer_name = config.get('printerName', '(sin configurar)')

    print('')
    print('========================================================')
    print('  PRINTER BRIDGE v3.0 (Python) - Solemar Alimentaria')
    print('========================================================')
    print('  Python:    {}'.format(sys.version.split()[0]))
    print('  pywin32:   {}'.format('OK' if win32print else 'NO INSTALADO'))
    print('  TCP:       {}:{}'.format(local_ip, tcp_port))
    print('  Panel Web: http://{}:{}'.format(local_ip, http_port))
    print('  Impresora: {}'.format(printer_name))
    print('========================================================')
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
