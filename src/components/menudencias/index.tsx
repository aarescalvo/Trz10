'use client'

import { useState, useEffect } from 'react'
import { 
  Package, Plus, Save, Printer, RefreshCw, Beef, 
  Calendar, Scale, Tag, CheckCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { TextoEditable, EditableBlock, useEditor } from '@/components/ui/editable-screen'

interface TipoMenudencia {
  id: string
  nombre: string
  activo: boolean
}

interface Menudencia {
  id: string
  tipoMenudencia: TipoMenudencia
  tipoMenudenciaId: string
  tropaCodigo?: string
  pesoIngreso?: number
  pesoElaborado?: number
  numeroBolsa?: number
  cantidadBolsas?: number
  operadorElaboracion?: string
  fechaIngreso: string
  fechaElaboracion?: string
  rotuloImpreso: boolean
  observaciones?: string
}

interface Tropa {
  id: string
  codigo: string
  cantidadCabezas: number
}

interface Operador {
  id: string
  nombre: string
  nivel?: string
}

export function MenudenciasModule({ operador }: { operador: Operador }) {
  const { editMode, getTexto } = useEditor()
  const [menudencias, setMenudencias] = useState<Menudencia[]>([])
  const [tiposMenudencia, setTiposMenudencia] = useState<TipoMenudencia[]>([])
  const [tropas, setTropas] = useState<Tropa[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [activeTab, setActiveTab] = useState('ingreso')
  
  // Form ingreso
  const [tipoMenudenciaId, setTipoMenudenciaId] = useState('')
  const [tropaCodigo, setTropaCodigo] = useState('')
  const [pesoIngreso, setPesoIngreso] = useState('')
  
  // Form elaboración
  const [menudenciaSeleccionada, setMenudenciaSeleccionada] = useState<Menudencia | null>(null)
  const [pesoElaborado, setPesoElaborado] = useState('')
  const [cantidadBolsas, setCantidadBolsas] = useState('')
  const [operadorElaboracion, setOperadorElaboracion] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [menudenciasRes, tiposRes, tropasRes] = await Promise.all([
        fetch('/api/menudencias'),
        fetch('/api/tipos-menudencia'),
        fetch('/api/tropas?estado=FAENADO')
      ])
      
      const menudenciasData = await menudenciasRes.json()
      const tiposData = await tiposRes.json()
      const tropasData = await tropasRes.json()
      
      if (menudenciasData.success) {
        setMenudencias(menudenciasData.data)
      }
      
      if (tiposData.success) {
        setTiposMenudencia(tiposData.data.filter((t: TipoMenudencia) => t.activo))
      }
      
      if (tropasData.success) {
        setTropas(tropasData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleIngreso = async () => {
    if (!tipoMenudenciaId || !pesoIngreso) {
      toast.error('Complete tipo y peso de ingreso')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/menudencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoMenudenciaId,
          tropaCodigo: tropaCodigo || null,
          pesoIngreso: parseFloat(pesoIngreso),
          operadorId: operador.id
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Menudencia registrada')
        setTipoMenudenciaId('')
        setTropaCodigo('')
        setPesoIngreso('')
        fetchData()
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleElaborar = async () => {
    if (!menudenciaSeleccionada || !pesoElaborado) {
      toast.error('Complete el peso elaborado')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/menudencias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: menudenciaSeleccionada.id,
          pesoElaborado: parseFloat(pesoElaborado),
          cantidadBolsas: parseInt(cantidadBolsas) || 1,
          operadorElaboracion: operadorElaboracion || operador.nombre
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Elaboración registrada')
        setMenudenciaSeleccionada(null)
        setPesoElaborado('')
        setCantidadBolsas('')
        setOperadorElaboracion('')
        fetchData()
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleImprimirRotulo = (menudencia: Menudencia) => {
    const printWindow = window.open('', '_blank', 'width=300,height=400')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Rótulo Menudencia</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 10px; }
            .rotulo { border: 2px solid black; padding: 10px; }
            .header { text-align: center; border-bottom: 1px solid black; padding-bottom: 5px; margin-bottom: 5px; }
            .empresa { font-size: 16px; font-weight: bold; }
            .campo { display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px; }
            .barcode { font-family: 'Libre Barcode 39', cursive; font-size: 24px; text-align: center; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="rotulo">
            <div class="header">
              <div class="empresa">SOLEMAR ALIMENTARIA</div>
              <div style="font-size: 12px;">Menudencia</div>
            </div>
            <div class="campo"><span>Tipo:</span><span style="font-weight: bold;">${menudencia.tipoMenudencia.nombre}</span></div>
            <div class="campo"><span>Tropa:</span><span>${menudencia.tropaCodigo || '-'}</span></div>
            <div class="campo"><span>Peso:</span><span>${menudencia.pesoElaborado?.toLocaleString() || menudencia.pesoIngreso?.toLocaleString()} kg</span></div>
            <div class="campo"><span>Bolsa N°:</span><span>${menudencia.numeroBolsa || '-'}</span></div>
            <div class="campo"><span>Fecha Faena:</span><span>${new Date(menudencia.fechaIngreso).toLocaleDateString('es-AR')}</span></div>
            <div class="campo"><span>Fecha Elab:</span><span>${menudencia.fechaElaboracion ? new Date(menudencia.fechaElaboracion).toLocaleDateString('es-AR') : '-'}</span></div>
            <div class="barcode">*${menudencia.id.slice(-8).toUpperCase()}*</div>
          </div>
          <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); } }</script>
        </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  const pendientesElaboracion = menudencias.filter(m => !m.pesoElaborado)
  const elaborados = menudencias.filter(m => m.pesoElaborado)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center">
        <Package className="w-8 h-8 animate-pulse text-amber-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <EditableBlock bloqueId="header" label="Encabezado">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-stone-800">
                <TextoEditable id="titulo-menudencias" original="Menudencias" tag="span" />
              </h1>
              <p className="text-stone-500">
                <TextoEditable id="subtitulo-menudencias" original="Registro y elaboración de subproductos" tag="span" />
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                <TextoEditable id="btn-actualizar-menu" original="Actualizar" tag="span" />
              </Button>
              <Badge variant="outline" className="text-lg px-4 py-2">
                <Package className="w-4 h-4 mr-2 text-amber-500" />
                {pendientesElaboracion.length} <TextoEditable id="label-pendientes-menu" original="pendientes" tag="span" />
              </Badge>
            </div>
          </div>
        </EditableBlock>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ingreso"><TextoEditable id="tab-ingreso-menu" original="Ingreso Post-Faena" tag="span" /></TabsTrigger>
            <TabsTrigger value="elaboracion"><TextoEditable id="tab-elaboracion-menu" original="Elaboración" tag="span" /></TabsTrigger>
            <TabsTrigger value="historial"><TextoEditable id="tab-historial-menu" original="Historial" tag="span" /></TabsTrigger>
          </TabsList>

          {/* INGRESO */}
          <TabsContent value="ingreso" className="space-y-6">
            <EditableBlock bloqueId="form-ingreso" label="Formulario de Ingreso">
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-stone-50 rounded-t-lg">
                  <CardTitle className="text-lg">
                    <TextoEditable id="titulo-ingreso-menu" original="Ingreso de Menudencias" tag="span" />
                  </CardTitle>
                  <CardDescription>
                    <TextoEditable id="desc-ingreso-menu" original="Registro de menudencias post-faena" tag="span" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label><TextoEditable id="label-tipo-menu" original="Tipo de Menudencia" tag="span" /></Label>
                      <Select value={tipoMenudenciaId} onValueChange={setTipoMenudenciaId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tiposMenudencia.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label><TextoEditable id="label-tropa-menu" original="Tropa (opcional)" tag="span" /></Label>
                      <Select value={tropaCodigo} onValueChange={setTropaCodigo}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tropas.map((t) => (
                            <SelectItem key={t.id} value={t.codigo}>{t.codigo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label><TextoEditable id="label-peso-ingreso-menu" original="Peso Ingreso (kg)" tag="span" /></Label>
                      <Input
                        type="number"
                        value={pesoIngreso}
                        onChange={(e) => setPesoIngreso(e.target.value)}
                        placeholder="0"
                        className="text-xl font-bold text-center"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={handleIngreso}
                        disabled={saving || !tipoMenudenciaId || !pesoIngreso}
                        className="w-full h-12 bg-green-600 hover:bg-green-700"
                      >
                        <Save className="w-5 h-5 mr-2" />
                        <TextoEditable id="btn-registrar-menu" original="Registrar" tag="span" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </EditableBlock>

            {/* Menudencias recientes */}
            <EditableBlock bloqueId="recientes" label="Menudencias Recientes">
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">
                    <TextoEditable id="titulo-recientes-menu" original="Menudencias Recién Ingresadas" tag="span" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {menudencias.filter(m => !m.pesoElaborado).length === 0 ? (
                    <div className="p-8 text-center text-stone-400">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p><TextoEditable id="msg-sin-pendientes-menu" original="No hay menudencias pendientes de elaboración" tag="span" /></p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead><TextoEditable id="th-tipo-menu" original="Tipo" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-tropa-menu" original="Tropa" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-peso-ingreso-tabla" original="Peso Ingreso" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-fecha-menu" original="Fecha" tag="span" /></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {menudencias.filter(m => !m.pesoElaborado).slice(0, 10).map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">{m.tipoMenudencia.nombre}</TableCell>
                            <TableCell className="font-mono">{m.tropaCodigo || '-'}</TableCell>
                            <TableCell className="font-bold">{m.pesoIngreso?.toLocaleString()} kg</TableCell>
                            <TableCell>{new Date(m.fechaIngreso).toLocaleDateString('es-AR')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </EditableBlock>
          </TabsContent>

          {/* ELABORACIÓN */}
          <TabsContent value="elaboracion" className="space-y-6">
            <EditableBlock bloqueId="elaboracion" label="Lista de Elaboración">
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-amber-50 rounded-t-lg">
                  <CardTitle className="text-lg">
                    <TextoEditable id="titulo-elaboracion-menu" original="Elaboración de Menudencias" tag="span" />
                  </CardTitle>
                  <CardDescription>
                    <TextoEditable id="desc-elaboracion-menu" original="Pesado, embolsado e impresión de rótulos" tag="span" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {pendientesElaboracion.length === 0 ? (
                    <div className="p-8 text-center text-stone-400">
                      <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p><TextoEditable id="msg-sin-menudencias" original="No hay menudencias pendientes" tag="span" /></p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead><TextoEditable id="th-tipo-elab" original="Tipo" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-tropa-elab" original="Tropa" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-peso-ing-elab" original="Peso Ingreso" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-fecha-elab" original="Fecha" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-acciones-elab" original="Acciones" tag="span" /></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendientesElaboracion.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">{m.tipoMenudencia.nombre}</TableCell>
                            <TableCell className="font-mono">{m.tropaCodigo || '-'}</TableCell>
                            <TableCell className="font-bold">{m.pesoIngreso?.toLocaleString()} kg</TableCell>
                            <TableCell>{new Date(m.fechaIngreso).toLocaleDateString('es-AR')}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setMenudenciaSeleccionada(m)
                                  setPesoElaborado(m.pesoIngreso?.toString() || '')
                                  setCantidadBolsas('1')
                                  setOperadorElaboracion(operador.nombre)
                                }}
                                className="bg-amber-500 hover:bg-amber-600"
                              >
                                <Scale className="w-4 h-4 mr-1" />
                                <TextoEditable id="btn-elaborar-menu" original="Elaborar" tag="span" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </EditableBlock>

            {/* Form elaboración */}
            {menudenciaSeleccionada && (
              <EditableBlock bloqueId="form-elaboracion" label="Formulario de Elaboración">
                <Card className="border-0 shadow-md border-amber-200">
                  <CardHeader className="bg-amber-50">
                    <CardTitle className="text-lg">
                      <TextoEditable id="titulo-form-elab" original="Elaborar:" tag="span" /> {menudenciaSeleccionada.tipoMenudencia.nombre}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label><TextoEditable id="label-peso-elab" original="Peso Elaborado (kg)" tag="span" /></Label>
                        <Input
                          type="number"
                          value={pesoElaborado}
                          onChange={(e) => setPesoElaborado(e.target.value)}
                          className="text-xl font-bold text-center"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label><TextoEditable id="label-bolsas-elab" original="Cantidad de Bolsas" tag="span" /></Label>
                        <Input
                          type="number"
                          value={cantidadBolsas}
                          onChange={(e) => setCantidadBolsas(e.target.value)}
                          min="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label><TextoEditable id="label-operador-elab" original="Operador" tag="span" /></Label>
                        <Input
                          value={operadorElaboracion}
                          onChange={(e) => setOperadorElaboracion(e.target.value)}
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <Button
                          onClick={handleElaborar}
                          disabled={saving || !pesoElaborado}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          <TextoEditable id="btn-guardar-elab" original="Guardar" tag="span" />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            handleImprimirRotulo(menudenciaSeleccionada)
                          }}
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </EditableBlock>
            )}
          </TabsContent>

          {/* HISTORIAL */}
          <TabsContent value="historial">
            <EditableBlock bloqueId="historial" label="Historial de Menudencias">
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-stone-50 rounded-t-lg">
                  <CardTitle className="text-lg">
                    <TextoEditable id="titulo-historial-menu" original="Menudencias Elaboradas" tag="span" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {elaborados.length === 0 ? (
                    <div className="p-8 text-center text-stone-400">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p><TextoEditable id="msg-sin-elaborados" original="No hay menudencias elaboradas" tag="span" /></p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead><TextoEditable id="th-tipo-hist" original="Tipo" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-tropa-hist" original="Tropa" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-peso-ing-hist" original="Peso Ingreso" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-peso-elab-hist" original="Peso Elaborado" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-bolsas-hist" original="Bolsas" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-fecha-hist" original="Fecha" tag="span" /></TableHead>
                          <TableHead><TextoEditable id="th-acciones-hist" original="Acciones" tag="span" /></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {elaborados.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">{m.tipoMenudencia.nombre}</TableCell>
                            <TableCell className="font-mono">{m.tropaCodigo || '-'}</TableCell>
                            <TableCell>{m.pesoIngreso?.toLocaleString()} kg</TableCell>
                            <TableCell className="font-bold text-green-600">{m.pesoElaborado?.toLocaleString()} kg</TableCell>
                            <TableCell>{m.cantidadBolsas}</TableCell>
                            <TableCell>{new Date(m.fechaElaboracion || m.fechaIngreso).toLocaleDateString('es-AR')}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleImprimirRotulo(m)}
                              >
                                <Printer className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </EditableBlock>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default MenudenciasModule
