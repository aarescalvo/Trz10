/**
 * Printer Bridge Service v2.0 - Solemar Alimentaria
 *
 * Escucha en TCP puerto 9100 y redirige los datos (ZPL/DPL)
 * a una impresora conectada por USB en Windows.
 *
 * NO necesita dependencias npm. Usa PowerShell + Win32 API.
 *
 * Arquitectura:
 *   Sistema (Next.js) -> TCP/IP :9100 -> Este bridge -> PowerShell -> Impresora USB
 *
 * Uso:
 *   node index.js
 *
 * Config: editar printer-config.json o usar el panel web en :9101
 */

const net = require('net')
const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')
const { exec } = require('child_process')

// ============================================================
// Configuracion
// ============================================================
const CONFIG_PATH = path.join(__dirname, 'printer-config.json')
const PRINT_HELPER = path.join(__dirname, 'print-helper.ps1')
const TEMP_DIR = path.join(__dirname, 'temp')

const DEFAULT_CONFIG = {
  printerName: '',
  tcpPort: 9100,
  httpPort: 9101,
  logLevel: 'info',
  autoStart: true
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    }
  } catch (e) {
    console.error('Error leyendo config:', e)
  }
  return DEFAULT_CONFIG
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config), 'utf-8')
}

let config = loadConfig()

// Asegurar temp dir
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

// Limpiar archivos temp viejos (>1 hora)
try {
  const tempFiles = fs.readdirSync(TEMP_DIR)
  const oneHourAgo = Date.now() - 3600000
  tempFiles.forEach(f => {
    const filePath = path.join(TEMP_DIR, f)
    try {
      if (fs.statSync(filePath).mtimeMs < oneHourAgo) {
        fs.unlinkSync(filePath)
      }
    } catch {}
  })
} catch {}

// ============================================================
// Logger
// ============================================================
function log(level, msg, data) {
  const levels = { error: 0, info: 1, debug: 2 }
  if (levels[level] <= levels[config.logLevel]) {
    const ts = new Date().toLocaleTimeString('es-AR')
    const prefix = level === 'error' ? '[ERROR]' : level === 'info' ? '[OK]' : '[DEBUG]'
    console.log(`${ts} ${prefix} ${msg}`, data !== undefined ? JSON.stringify(data) : '')
  }
}

// ============================================================
// Impresion via PowerShell + Win32 API
// ============================================================
function listPrinters() {
  return new Promise((resolve) => {
    exec(
      'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
      { encoding: 'utf-8', timeout: 10000 },
      (error, stdout) => {
        if (error) {
          resolve([])
          return
        }
        resolve(stdout.trim().split('\n').map(s => s.trim()).filter(Boolean))
      }
    )
  })
}

function printRaw(printerName, data) {
  return new Promise((resolve) => {
    if (!printerName) {
      log('error', 'No hay impresora configurada')
      resolve({ success: false, error: 'No hay impresora configurada' })
      return
    }

    if (!fs.existsSync(PRINT_HELPER)) {
      log('error', 'No encuentro print-helper.ps1')
      resolve({ success: false, error: 'No encuentro print-helper.ps1 en ' + __dirname })
      return
    }

    // Generar archivo temporal unico
    const jobId = Date.now() + '-' + Math.random().toString(36).substr(2, 6)
    const tempFile = path.join(TEMP_DIR, `job-${jobId}.zpl`)

    try {
      fs.writeFileSync(tempFile, data)
    } catch (err) {
      resolve({ success: false, error: 'No se pudo crear archivo temp: ' + err.message })
      return
    }

    log('info', `Enviando ${data.length} bytes a "${printerName}"`)

    const escapedPrinter = printerName.replace(/'/g, "''")
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "& '${PRINT_HELPER}' -PrinterName '${escapedPrinter}' -FilePath '${tempFile}'"`

    exec(psCmd, { timeout: 30000, encoding: 'utf-8' }, (error, stdout, stderr) => {
      // Limpiar archivo temp
      try { fs.unlinkSync(tempFile) } catch {}

      const output = (stdout || '').trim()
      const errOutput = (stderr || '').trim()

      // El helper emite ERROR:xxx o OK:xxx por stdout.
      // PowerShell puede salir con exit 1 pero aun asi tener stdout util.
      // Priorizar el mensaje estructurado del helper.
      if (output.startsWith('OK:')) {
        const bytes = output.substring(3)
        log('info', `Impresion exitosa (${bytes} bytes)`)
        resolve({ success: true, bytesWritten: parseInt(bytes) })
        return
      }

      if (output.startsWith('ERROR:')) {
        const errorMsg = output.substring(6)
        log('error', `Error de impresion: ${errorMsg}`)
        resolve({ success: false, error: errorMsg })
        return
      }

      // Si llegamos aca, no hubo respuesta estructurada
      if (error) {
        let detail = error.message || ''
        if (errOutput) detail += ' | stderr: ' + errOutput
        if (output) detail += ' | stdout: ' + output
        log('error', `Error ejecutando PowerShell: ${detail}`)
        resolve({ success: false, error: 'Error PowerShell: ' + detail })
        return
      }

      // Sin error pero sin respuesta esperada
      log('error', `Respuesta inesperada: ${output}`)
      if (errOutput) log('error', `stderr: ${errOutput}`)
      resolve({ success: false, error: 'Respuesta inesperada del helper: ' + output })
    })
  })
}

// ============================================================
// Servidor TCP (puerto 9100)
// ============================================================
let printCount = 0
let lastPrintTime = ''

const tcpServer = net.createServer((socket) => {
  const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`
  log('info', `Conexion entrante desde ${remoteAddress}`)

  const chunks = []
  let totalBytes = 0

  socket.on('data', (chunk) => {
    chunks.push(chunk)
    totalBytes += chunk.length
  })

  socket.on('end', async () => {
    const data = Buffer.concat(chunks)

    if (totalBytes === 0) {
      log('info', 'Conexion cerrada sin datos')
      return
    }

    if (!config.printerName) {
      log('error', 'No hay impresora configurada')
      socket.end()
      return
    }

    const result = await printRaw(config.printerName, data)
    printCount++
    lastPrintTime = new Date().toLocaleString('es-AR')

    if (result.success) {
      log('info', `Impresion #${printCount} exitosa`)
    } else {
      log('error', `Impresion #${printCount} fallida: ${result.error}`)
    }

    socket.end()
  })

  socket.on('error', (err) => {
    log('error', `Error en socket: ${err.message}`)
  })

  socket.on('timeout', () => {
    log('error', 'Timeout en conexion TCP')
    socket.destroy()
  })

  socket.setTimeout(30000)
})

// ============================================================
// Servidor HTTP (puerto 9101) - Panel de control
// ============================================================
const httpServer = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')

  // API: listar impresoras
  if (req.method === 'GET' && req.url === '/api/printers') {
    const printers = await listPrinters()
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ printers, configured: config.printerName }))
    return
  }

  // API: obtener config
  if (req.method === 'GET' && req.url === '/api/config') {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      ...config,
      printCount,
      lastPrintTime,
      status: 'running',
      uptime: Math.floor(process.uptime())
    }))
    return
  }

  // API: guardar config
  if (req.method === 'POST' && req.url === '/api/config') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const newConfig = JSON.parse(body)
        if (newConfig.printerName !== undefined) config.printerName = newConfig.printerName
        if (newConfig.tcpPort !== undefined) config.tcpPort = parseInt(newConfig.tcpPort)
        if (newConfig.httpPort !== undefined) config.httpPort = parseInt(newConfig.httpPort)
        if (newConfig.logLevel !== undefined) config.logLevel = newConfig.logLevel
        saveConfig(config)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, config }))
      } catch {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'JSON invalido' }))
      }
    })
    return
  }

  // API: prueba de impresion
  if (req.method === 'POST' && req.url === '/api/test') {
    if (!config.printerName) {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ success: false, error: 'No hay impresora configurada' }))
      return
    }

    // Detectar tipo de impresora y enviar prueba correspondiente
    const printerLower = config.printerName.toLowerCase()
    let testData = ''
    let testType = ''

    if (printerLower.includes('datamax') || printerLower.includes('honeywell')) {
      // DPL de prueba para Datamax
      const fecha = new Date().toLocaleString('es-AR')
      testData = '<STX><ESC>C1<ETX>\n' +
        '<STX>H0080;o50,30;h1;w4;c26;f0;d3,PRUEBA<ETX>\n' +
        '<STX>H0080;o50,80;h1;w2;c26;f0;d3,DATAMAX - Bridge OK<ETX>\n' +
        '<STX>H0080;o50,120;h1;w2;c20;f0;d3,' + fecha + '<ETX>\n' +
        '<STX>H0080;o50,160;h1;w2;c20;f0;d3,Solemar Alimentaria<ETX>\n' +
        '<STX><ETX>'
      testType = 'DPL'
    } else if (printerLower.includes('sato')) {
      // SBPL de prueba para Sato
      const fecha = new Date().toLocaleString('es-AR')
      testData = '<ESC>A<ESC>H0050<ESC>V0100<ESC>XLFDATS;** PRUEBA **<ESC>Q<ESC>Z\n' +
        '<ESC>A<ESC>H0050<ESC>V0200<ESC>XLFDATS;SATO - Bridge OK<ESC>Q<ESC>Z\n' +
        '<ESC>A<ESC>H0050<ESC>V0300<ESC>XLFDATS;' + fecha + '<ESC>Q<ESC>Z\n' +
        '<ESC>A<ESC>H0050<ESC>V0400<ESC>XLFDATS;Solemar Alimentaria<ESC>Q<ESC>Z\n'
      testType = 'SBPL'
    } else {
      // ZPL de prueba por defecto (Zebra, etc.)
      const fecha = new Date().toLocaleString('es-AR')
      testData = '^XA\n' +
        '^FO50,50^A0N,40,40^FD** PRUEBA **^FS\n' +
        '^FO50,100^A0N,25,25^FDZebra ZT230 - Bridge OK^FS\n' +
        '^FO50,140^A0N,20,20^FD' + fecha + '^FS\n' +
        '^FO50,180^A0N,20,20^FDSolemar Alimentaria^FS\n' +
        '^XZ'
      testType = 'ZPL'
    }

    const result = await printRaw(config.printerName, testData)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ...result, testType }))
    return
  }

  // API: diagnostico
  if (req.method === 'GET' && req.url === '/api/diagnose') {
    const diag = {
      nodeVersion: process.version,
      platform: process.platform,
      configPath: CONFIG_PATH,
      configExists: fs.existsSync(CONFIG_PATH),
      helperPath: PRINT_HELPER,
      helperExists: fs.existsSync(PRINT_HELPER),
      tempDir: TEMP_DIR,
      tempDirExists: fs.existsSync(TEMP_DIR),
      config: config,
      printers: await listPrinters()
    }
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(diag, null, 2))
    return
  }

  // Dashboard HTML
  res.end(generateDashboard())
})

function generateDashboard() {
  const printerNameEscaped = (config.printerName || '').replace(/'/g, "\\'")
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Printer Bridge - Solemar Alimentaria</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f5f5f4; color: #292524; padding: 20px; }
    .container { max-width: 700px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 4px; color: #1c1917; }
    .subtitle { color: #78716c; margin-bottom: 24px; font-size: 14px; }
    .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card h2 { font-size: 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    .status.online { background: #dcfce7; color: #166534; }
    .status .dot { width: 8px; height: 8px; border-radius: 50%; }
    .status.online .dot { background: #22c55e; }
    select { width: 100%; padding: 10px 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-size: 14px; background: white; cursor: pointer; margin-bottom: 12px; }
    select:focus { outline: none; border-color: #f59e0b; }
    .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: #f59e0b; color: white; }
    .btn-primary:hover { background: #d97706; }
    .btn-secondary { background: #e7e5e4; color: #292524; }
    .btn-secondary:hover { background: #d6d3d1; }
    .btn-group { display: flex; gap: 8px; margin-top: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .info-item { padding: 12px; background: #fafaf9; border-radius: 8px; }
    .info-item .label { font-size: 12px; color: #78716c; margin-bottom: 4px; }
    .info-item .value { font-size: 18px; font-weight: 700; color: #1c1917; }
    .toast { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 8px; color: white; font-weight: 600; opacity: 0; transition: opacity 0.3s; }
    .toast.success { background: #22c55e; }
    .toast.error { background: #ef4444; }
    .instructions { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; font-size: 13px; line-height: 1.6; }
    .instructions h3 { color: #92400e; margin-bottom: 8px; }
    .instructions code { background: #fef3c7; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .error-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; font-size: 13px; color: #991b1b; margin-top: 8px; display: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Printer Bridge v2.0</h1>
    <p class="subtitle">Solemar Alimentaria - Puente TCP -> Impresora USB</p>

    <div class="card">
      <h2>
        <span class="status online"><span class="dot"></span> Conectado</span>
      </h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="label">Puerto TCP</div>
          <div class="value" id="tcpPort">${config.tcpPort}</div>
        </div>
        <div class="info-item">
          <div class="label">Impresiones</div>
          <div class="value" id="printCount">0</div>
        </div>
        <div class="info-item">
          <div class="label">Ultima impresion</div>
          <div class="value" id="lastPrint" style="font-size:14px">-</div>
        </div>
        <div class="info-item">
          <div class="label">Impresora</div>
          <div class="value" id="currentPrinter" style="font-size:14px">${config.printerName || 'Sin configurar'}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Configurar Impresora</h2>
      <select id="printerSelect">
        <option value="">-- Seleccionar impresora --</option>
      </select>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="savePrinter()">Guardar</button>
        <button class="btn btn-secondary" onclick="loadPrinters()">Actualizar lista</button>
      </div>
    </div>

    <div class="card">
      <h2>Probar Impresion</h2>
      <p style="font-size:13px; color:#78716c; margin-bottom:12px">
        Imprime una etiqueta de prueba. Detecta automaticamente el lenguaje (ZPL/DPL) segun la impresora.
      </p>
      <button class="btn btn-primary" onclick="testPrint()">Imprimir prueba</button>
      <div class="error-box" id="testError"></div>
    </div>

    <div class="card">
      <h2>Configurar en el Sistema</h2>
      <div class="instructions">
        <h3>Para que el sistema imprima a esta PC:</h3>
        <p><strong>1.</strong> Verifica la IP de esta PC con <code>ipconfig</code>.</p>
        <p><strong>2.</strong> En el sistema ir a <strong>Configuracion - Impresoras</strong>.</p>
        <p><strong>3.</strong> Crear/editar impresora:</p>
        <p>&nbsp;&nbsp; Puerto: <strong>RED</strong></p>
        <p>&nbsp;&nbsp; IP: <strong>la IP de esta PC</strong></p>
        <p>&nbsp;&nbsp; Marca: ZEBRA / DATAMAX | Modelo: segun impresora | DPI: 203</p>
        <p><strong>4.</strong> Puerto TCP: <strong>${config.tcpPort}</strong></p>
      </div>
    </div>

    <div class="card">
      <h2>Diagnostico</h2>
      <button class="btn btn-secondary" onclick="runDiagnose()">Ejecutar diagnostico</button>
      <div class="error-box" id="diagOutput" style="display:none; color:#292524; background:#f5f5f4; border-color:#d6d3d1; white-space:pre-wrap; font-family:monospace; font-size:12px; margin-top:12px;"></div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    let config = ${JSON.stringify(config)};

    function showToast(msg, type) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast ' + type;
      t.style.opacity = '1';
      setTimeout(() => { t.style.opacity = '0'; }, 3000);
    }

    async function loadPrinters() {
      try {
        const res = await fetch('/api/printers');
        const data = await res.json();
        const sel = document.getElementById('printerSelect');
        sel.innerHTML = '<option value="">-- Seleccionar impresora --</option>';
        data.printers.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p;
          opt.textContent = p;
          if (p === data.configured) opt.selected = true;
          sel.appendChild(opt);
        });
      } catch (e) {
        showToast('Error al cargar impresoras', 'error');
      }
    }

    async function savePrinter() {
      const printerName = document.getElementById('printerSelect').value;
      if (!printerName) {
        showToast('Selecciona una impresora', 'error');
        return;
      }
      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printerName })
        });
        const data = await res.json();
        if (data.success) {
          config.printerName = printerName;
          document.getElementById('currentPrinter').textContent = printerName;
          showToast('Impresora configurada: ' + printerName, 'success');
        }
      } catch (e) {
        showToast('Error al guardar', 'error');
      }
    }

    async function testPrint() {
      const errBox = document.getElementById('testError');
      errBox.style.display = 'none';

      if (!config.printerName) {
        showToast('Configura una impresora primero', 'error');
        return;
      }

      const btn = event.target;
      btn.disabled = true;
      btn.textContent = 'Imprimiendo...';

      try {
        const res = await fetch('/api/test', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
          showToast('Prueba enviada - ' + data.bytesWritten + ' bytes', 'success');
        } else {
          errBox.textContent = 'Error: ' + data.error;
          errBox.style.display = 'block';
          showToast('Error en la prueba', 'error');
        }
      } catch (e) {
        errBox.textContent = 'Error de conexion: ' + e.message;
        errBox.style.display = 'block';
        showToast('Error de conexion', 'error');
      }

      btn.disabled = false;
      btn.textContent = 'Imprimir prueba';
    }

    async function refreshStats() {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        document.getElementById('printCount').textContent = data.printCount;
        document.getElementById('lastPrint').textContent = data.lastPrintTime || '-';
      } catch {}
    }

    async function runDiagnose() {
      const out = document.getElementById('diagOutput');
      out.style.display = 'block';
      out.textContent = 'Ejecutando diagnostico...';

      try {
        const res = await fetch('/api/diagnose');
        const data = await res.json();
        out.textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        out.textContent = 'Error: ' + e.message;
      }
    }

    loadPrinters();
    setInterval(refreshStats, 5000);
  </script>
</body>
</html>`
}

// ============================================================
// Inicio
// ============================================================
function start() {
  const nets = os.networkInterfaces()
  let localIP = 'localhost'
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) {
      if (n.family === 'IPv4' && !n.internal) {
        localIP = n.address
        break
      }
    }
    if (localIP !== 'localhost') break
  }

  // Verificar archivos
  if (!fs.existsSync(PRINT_HELPER)) {
    console.error('========================================================')
    console.error('  ERROR: No encuentro print-helper.ps1')
    console.error('  Asegurate de tener todos los archivos descargados.')
    console.error('  Archivos necesarios: index.js, print-helper.ps1')
    console.error('========================================================')
    process.exit(1)
  }

  // Servidor TCP (puerto 9100)
  tcpServer.listen(config.tcpPort, '0.0.0.0', () => {
    console.log('========================================================')
    console.log('  PRINTER BRIDGE v2.0 - Solemar Alimentaria')
    console.log('========================================================')
    console.log('  TCP:  ' + localIP + ':' + config.tcpPort + ' (recibe datos ZPL/DPL)')
    console.log('  HTTP: http://' + localIP + ':' + config.httpPort + ' (panel de control)')
    console.log('  Impresora: ' + (config.printerName || '(sin configurar)'))
    console.log('========================================================')
    console.log('')
    console.log('Abri http://localhost:' + config.httpPort + ' para configurar')
    console.log('')
  })

  tcpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('ERROR: Puerto ' + config.tcpPort + ' ya esta en uso.')
    } else {
      console.error('ERROR TCP:', err.message)
    }
    process.exit(1)
  })

  // Servidor HTTP (panel de control)
  httpServer.listen(config.httpPort, '0.0.0.0', () => {
    log('debug', 'Panel web en http://localhost:' + config.httpPort)
  })

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log('error', 'Puerto HTTP ' + config.httpPort + ' ya en uso')
    }
  })
}

start()
