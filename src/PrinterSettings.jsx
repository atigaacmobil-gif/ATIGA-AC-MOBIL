import { useEffect, useMemo, useState } from 'react'
import { createPrinterManager } from './printer'

const panelStyle = {
  border: '1px solid #e1e8f2',
  borderRadius: 12,
  padding: 18,
  background: '#fff',
  marginBottom: 16
}

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 11px',
  border: '1px solid #d7e0ed',
  borderRadius: 8,
  background: '#fff',
  color: '#17263d',
  fontSize: 14
}

const actionStyle = {
  border: 0,
  borderRadius: 8,
  padding: '9px 13px',
  background: '#0860dc',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer'
}

const statusLabels = {
  DISCONNECTED: 'Belum terhubung',
  CONNECTING: 'Menghubungkan',
  NOT_FOUND: 'Tidak ditemukan',
  CONNECTION_FAILED: 'Koneksi gagal',
  CONNECTED: 'Terhubung',
  READY: 'Siap',
  PRINTING: 'Sedang mencetak',
  PRINT_FAILED: 'Cetak gagal'
}

export default function PrinterSettings() {
  const manager = useMemo(() => createPrinterManager(), [])
  const [snapshot, setSnapshot] = useState(() => manager.getSnapshot())
  const [connectionType, setConnectionType] = useState('bluetooth')
  const [name, setName] = useState('RONGTA RPP02N')
  const [deviceIdentifier, setDeviceIdentifier] = useState('')
  const [ipAddress, setIpAddress] = useState('')
  const [port, setPort] = useState('9100')
  const [paperSize, setPaperSize] = useState('58')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => manager.subscribe(setSnapshot), [manager])

  const printers = snapshot.printers || []

  const runAction = (action) => {
    setError('')
    setNotice('')
    try {
      action()
      setSnapshot(manager.getSnapshot())
      setNotice('Pengaturan printer berhasil disimpan pada perangkat ini.')
    } catch (err) {
      setError(err?.message || 'Pengaturan printer gagal disimpan.')
    }
  }

  const addPrinter = (event) => {
    event.preventDefault()
    runAction(() => {
      const input = {
        name,
        connectionType,
        paperSize,
        ...(connectionType === 'wifi'
          ? { ipAddress, port: Number(port) }
          : { deviceIdentifier })
      }
      manager.addPrinter(input)
      if (!manager.getSelectedPrinterId()) {
        const newest = manager.getSnapshot().printers.at(-1)
        if (newest) manager.setPrimaryPrinter(newest.id)
      }
      setDeviceIdentifier('')
      setIpAddress('')
      setNotice('Printer berhasil didaftarkan. Status awal: belum terhubung.')
    })
  }

  const changePrimary = (id) => runAction(() => manager.setPrimaryPrinter(id || null))
  const changeBackup = (id) => runAction(() => manager.setBackupPrinter(id || null))
  const changeDefaults = (key, value) => runAction(() => manager.setDefaults({
    defaultPaperSize: key === 'paper' ? value : snapshot.defaultPaperSize,
    defaultCopies: key === 'copies' ? Number(value) : snapshot.defaultCopies
  }))

  const testPrint = () => {
    setError('')
    setNotice('')

    const printWindow = window.open('', '_blank', 'width=420,height=600')
    if (!printWindow) {
      setError('Jendela cetak diblokir. Izinkan pop-up untuk situs ini.')
      return
    }

    const primaryPrinter = printers.find(
      (item) => item.id === snapshot.primaryPrinterId
    )
    const paperWidth = (primaryPrinter?.paperSize || snapshot.defaultPaperSize) === '80'
      ? '80mm'
      : '58mm'

    printWindow.document.open()
    printWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Cetak Uji Printer</title>
<style>
  @page { size: ${paperWidth} auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { width: ${paperWidth === '80mm' ? '72mm' : '46mm'}; margin: 0 auto; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #111;
    padding: 3mm 1mm;
    text-align: center;
  }
  h2 { font-size: 15px; margin: 8px 0; }
  .line { border-top: 1px dashed #111; margin: 10px 0; }
</style>
</head>
<body>
  <h2>ATIGA AC MOBIL</h2>
  <div class="line"></div>
  <strong>TES CETAK PRINTER</strong>
  <p>Printer: ${primaryPrinter?.name || 'Printer Windows'}</p>
  <p>Kertas: ${paperWidth}</p>
  <div class="line"></div>
  <p>Jika tulisan ini tercetak dengan baik, jalur cetak berfungsi.</p>
  <p>Terima kasih</p>
  <script>
    window.onload = () => {
      setTimeout(() => {
        window.focus()
        window.print()
      }, 300)
    }
    window.onafterprint = () => window.close()
  <\/script>
</body>
</html>`)
    printWindow.document.close()
    setNotice('Halaman uji dibuka. Pilih printer RONGTA pada dialog cetak Windows.')
  }
  const deletePrinter = (printer) => {
    let replacementPrimaryId
    if (printer.id === snapshot.primaryPrinterId) {
      const remaining = printers.filter((item) => item.id !== printer.id)
      if (remaining.length) {
        const choices = remaining.filter((item) => item.id !== snapshot.backupPrinterId)
        if (!choices.length) {
          setError('Kosongkan atau ubah printer cadangan terlebih dahulu sebelum menghapus printer utama.')
          return
        }
        replacementPrimaryId = window.prompt(
          `Masukkan nomor pilihan printer utama pengganti:\n${choices.map((item, index) => `${index + 1}. ${item.name}`).join('\n')}`,
          '1'
        )
        if (replacementPrimaryId === null) return
        const selected = choices[Number(replacementPrimaryId) - 1]
        if (!selected) {
          setError('Pilihan printer pengganti tidak valid.')
          return
        }
        replacementPrimaryId = selected.id
      }
    }
    if (!window.confirm(`Hapus printer "${printer.name}" dari daftar perangkat ini?`)) return
    runAction(() => manager.deletePrinter(printer.id, { replacementPrimaryId }))
  }

  return (
    <section style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>ðŸ–¨ï¸</span>
        <div>
          <h3 style={{ margin: 0, color: '#17263d', fontSize: 17 }}>Perangkat Printer</h3>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 12 }}>
            Pusat pengelolaan printer pada perangkat ini
          </p>
        </div>
      </div>

      <div style={{ padding: 12, borderRadius: 9, background: '#fff8e8', color: '#805b12', fontSize: 12, margin: '12px 0' }}>
        Tahap ini untuk mendaftarkan dan mengatur printer. Pencarian Bluetooth, koneksi fisik, dan cetak uji akan diaktifkan pada tahap integrasi berikutnya. Printer yang didaftarkan belum berarti sudah terhubung.
      </div>

      <button
        type="button"
        onClick={testPrint}
        style={{ ...actionStyle, margin: '4px 0 12px' }}
      >
        Cetak Uji Printer
      </button>

      {snapshot.warning && (
        <p style={{ color: '#9a6700', fontSize: 13 }}>{snapshot.warning}</p>
      )}
      {error && <p role="alert" style={{ color: '#b42318', fontSize: 13 }}>{error}</p>}
      {notice && <p role="status" style={{ color: '#087443', fontSize: 13 }}>{notice}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginBottom: 16 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
          Printer utama
          <select value={snapshot.primaryPrinterId || ''} onChange={(event) => changePrimary(event.target.value)} style={fieldStyle}>
            <option value="">Belum dipilih</option>
            {printers.filter((item) => item.id !== snapshot.backupPrinterId).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
          Printer cadangan
          <select value={snapshot.backupPrinterId || ''} onChange={(event) => changeBackup(event.target.value)} style={fieldStyle}>
            <option value="">Tidak menggunakan cadangan</option>
            {printers.filter((item) => item.id !== snapshot.primaryPrinterId).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
          Ukuran kertas bawaan
          <select value={snapshot.defaultPaperSize} onChange={(event) => changeDefaults('paper', event.target.value)} style={fieldStyle}>
            <option value="58">58 mm</option>
            <option value="80">80 mm</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
          Jumlah salinan bawaan
          <select value={snapshot.defaultCopies} onChange={(event) => changeDefaults('copies', event.target.value)} style={fieldStyle}>
            <option value={1}>1 salinan</option>
            <option value={2}>2 salinan</option>
            <option value={3}>3 salinan</option>
          </select>
        </label>
      </div>

      <h4 style={{ margin: '18px 0 10px', color: '#17263d' }}>Daftar printer tersimpan ({printers.length})</h4>
      {printers.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 13 }}>Belum ada printer yang didaftarkan.</p>
      ) : (
        <div style={{ display: 'grid', gap: 9 }}>
          {printers.map((printer) => (
            <div key={printer.id} style={{ border: '1px solid #e1e8f2', borderRadius: 9, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 180 }}>
                <strong style={{ color: '#17263d', fontSize: 14 }}>{printer.name}</strong>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                  {printer.connectionType.toUpperCase()} Â· {printer.paperSize} mm
                  {printer.connectionType === 'wifi' ? ` Â· ${printer.ipAddress}:${printer.port}` : ` Â· ${printer.deviceIdentifier}`}
                </div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>
                  {printer.role === 'PRIMARY' ? 'Printer utama' : printer.role === 'BACKUP' ? 'Printer cadangan' : 'Belum ditetapkan'} Â· {statusLabels[printer.status] || printer.status}
                </div>
              </div>
              <button type="button" onClick={() => deletePrinter(printer)} style={{ ...actionStyle, background: '#fff0f0', color: '#b42318' }}>
                Hapus
              </button>
            </div>
          ))}
        </div>
      )}

      <h4 style={{ margin: '20px 0 10px', color: '#17263d' }}>Daftarkan printer baru</h4>
      <form onSubmit={addPrinter} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
          Nama printer
          <input value={name} onChange={(event) => setName(event.target.value)} required style={fieldStyle} />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
          Jenis koneksi
          <select value={connectionType} onChange={(event) => setConnectionType(event.target.value)} style={fieldStyle}>
            <option value="bluetooth">Bluetooth</option>
            <option value="wifi">Wi-Fi / LAN</option>
            <option value="usb">USB</option>
          </select>
        </label>
        {connectionType === 'wifi' ? (
          <>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
              Alamat IP printer
              <input value={ipAddress} onChange={(event) => setIpAddress(event.target.value)} placeholder="Contoh: 192.168.1.100" required style={fieldStyle} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
              Port
              <input type="number" min="1" max="65535" value={port} onChange={(event) => setPort(event.target.value)} required style={fieldStyle} />
            </label>
          </>
        ) : (
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
            Identitas perangkat
            <input value={deviceIdentifier} onChange={(event) => setDeviceIdentifier(event.target.value)} placeholder="Nama Bluetooth / ID perangkat" required style={fieldStyle} />
          </label>
        )}
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
          Ukuran kertas printer
          <select value={paperSize} onChange={(event) => setPaperSize(event.target.value)} style={fieldStyle}>
            <option value="58">58 mm</option>
            <option value="80">80 mm</option>
          </select>
        </label>
        <div style={{ display: 'flex', alignItems: 'end' }}>
          <button type="submit" style={actionStyle}>Simpan printer</button>
        </div>
      </form>
    </section>
  )
}



