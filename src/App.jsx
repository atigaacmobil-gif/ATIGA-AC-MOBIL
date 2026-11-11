
import { useEffect, useMemo, useState } from 'react'
import AuthGate from './AuthGate'
import { supabase } from './supabase'
import PrinterSettings from './PrinterSettings'
import './App.css'

const MENU = [
  ['Dashboard', '▦'],
  ['Pelanggan', '♙'],
  ['Kendaraan', '🚘'],
  ['Uraian Pekerjaan', '▤'],
  ['Kasir', '💳'],
  ['Layanan', '⚙'],
  ['Produk', '▣'],
  ['Transaksi', '💰'],
  ['Pengeluaran', '↘'],
  ['Laporan', '▥'],
  ['Pengaturan', '⚙']
]

const COLLECTIONS = {
  customers: 'Pelanggan',
  vehicles: 'Kendaraan',
  jobs: 'Uraian Pekerjaan',
  services: 'Layanan',
  products: 'Produk',
  transactions: 'Transaksi',
  expenses: 'Pengeluaran'
}

const EMPTY_DATA = {
  customers: [],
  vehicles: [],
  jobs: [],
  services: [],
  products: [],
  transactions: [],
  expenses: []
}

const DEFAULT_SETTINGS = {
  businessName: 'ATIGA AC MOBIL',
  slogan: 'Service dan Perawatan AC Mobil',
  address: '',
  phone: '',
  email: '',
  dashboardTitle: 'Selamat Datang di ATIGA AC MOBIL',
  dashboardDescription:
    'Solusi terpercaya untuk service dan perawatan AC mobil Anda.',
  announcement: '',
  logoUrl: '/logo-atiga.jpeg',
  bannerUrl: '/mobil-dashboard.png',
  primaryColor: '#082d59',
  layoutMode: 'auto',
  receiptPaperWidth: '58',
  receiptShowLogo: true,
  receiptShowAddress: true,
  receiptShowPhone: true,
  receiptShowSlogan: true,
  receiptFooter: 'Terima kasih telah mempercayakan perawatan AC mobil Anda kepada kami.',
  receiptShowCustomer: true,
  receiptShowVehicle: true
}

const money = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value || 0))

const today = () => new Date().toISOString().slice(0, 10)

const makeId = () =>
  Date.now().toString() + '-' + Math.random().toString(36).slice(2)

const sum = (items) =>
  items.reduce((total, item) => total + Number(item.amount || 0), 0)

const inputStyle = {
  width: '100%',
  padding: '11px 12px',
  border: '1px solid #d7e0ed',
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box',
  background: '#fff',
  color: '#17263d'
}

const buttonStyle = {
  border: 0,
  borderRadius: 8,
  padding: '10px 15px',
  background: '#0860dc',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer'
}

const cardStyle = {
  background: '#fff',
  border: '1px solid #e1e8f2',
  borderRadius: 12,
  padding: 18,
  boxShadow: '0 3px 12px rgba(15, 55, 100, 0.04)'
}

function App() {
  return (
    <AuthGate>
      {({ session, profile, onSignOut }) => (
        <Workshop
          session={session}
          profile={profile}
          onSignOut={onSignOut}
        />
      )}
    </AuthGate>
  )
}

function Workshop({ profile, onSignOut }) {
  const isAdmin = profile?.role === 'admin'

  const [page, setPage] = useState('Dashboard')
  const [data, setData] = useState(EMPTY_DATA)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})

  const [cashier, setCashier] = useState({
    customerId: '',
    vehicleId: '',
    description: '',
    paymentMethod: 'Tunai',
    status: 'Lunas'
  })
  const [cashierCart, setCashierCart] = useState([])
  const [selectedCatalogItem, setSelectedCatalogItem] = useState('')
  const [cashierMobilePanel, setCashierMobilePanel] = useState('input')

  const openPage = (name) => {
    setPage(name)
    setSearch('')
    setError('')
    setSuccess('')
  }

  const loadData = async () => {
    if (!supabase) {
      setError('Koneksi Supabase belum tersedia. Periksa file .env.')
      setLoading(false)
      return
    }

    try {
      const { data: rows, error: loadError } = await supabase
        .from('app_records')
        .select('collection, record_id, payload')

      if (loadError) throw loadError

      const next = { ...EMPTY_DATA }
      let savedSettings = DEFAULT_SETTINGS

      ;(rows || []).forEach((row) => {
        if (next[row.collection]) {
          next[row.collection].push({
            ...row.payload,
            id: row.record_id
          })
        }

        if (
          row.collection === 'settings' &&
          row.record_id === 'business_settings'
        ) {
          savedSettings = {
            ...DEFAULT_SETTINGS,
            ...(row.payload || {})
          }
        }
      })

      setData(next)
      setSettings(savedSettings)
      setError('')
    } catch (err) {
      setError('Gagal memuat data: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    if (!supabase) return undefined

    const channel = supabase
      .channel('atiga-app-records')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_records' },
        () => loadData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const saveSettings = async () => {
    if (!isAdmin) {
      setError('Hanya Admin yang dapat mengubah pengaturan.')
      return
    }

    if (!supabase) {
      setError('Supabase belum terhubung.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { error: saveError } = await supabase
        .from('app_records')
        .upsert(
          {
            collection: 'settings',
            record_id: 'business_settings',
            payload: settings
          },
          { onConflict: 'collection,record_id' }
        )

      if (saveError) throw saveError

      setSuccess('Pengaturan usaha berhasil disimpan.')
    } catch (err) {
      setError('Gagal menyimpan pengaturan: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const uploadSettingsImage = async (file, type) => {
    if (!isAdmin || !file) return

    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar JPG, PNG, atau WebP.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Ukuran logo maksimal 4 MB. Kecilkan ukuran gambar lalu coba lagi.')
      return
    }

    if (!supabase) {
      setError('Supabase belum terhubung.')
      return
    }

    setUploadingImage(true)
    setError('')
    setSuccess('')

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-')
      const filePath =
        type + '/' + Date.now() + '-' + safeName

      const { error: uploadError } = await supabase.storage
        .from('atiga-assets')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type
        })

      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage
        .from('atiga-assets')
        .getPublicUrl(filePath)
      const imageUrl = publicData?.publicUrl
      if (!imageUrl) throw new Error('URL publik logo tidak berhasil dibuat. Periksa bucket atiga-assets di Supabase.')

      const settingKey = type === 'logo' ? 'logoUrl' : 'bannerUrl'
      const nextSettings = { ...settings, [settingKey]: imageUrl }
      setSettings(nextSettings)

      // Persist the uploaded image URL immediately so it is not lost if the user
      // navigates away before pressing the general settings save button.
      const { error: settingsError } = await supabase
        .from('app_records')
        .upsert(
          { collection: 'settings', record_id: 'business_settings', payload: nextSettings },
          { onConflict: 'collection,record_id' }
        )
      if (settingsError) throw settingsError

      setSuccess(
        type === 'logo'
          ? 'Logo berhasil diunggah, disimpan, dan ditampilkan pada pratinjau. Pastikan opsi “Tampilkan logo usaha” aktif agar tercetak pada nota.'
          : 'Banner berhasil diunggah dan pengaturannya langsung disimpan.'
      )
    } catch (err) {
      setError('Gagal mengunggah gambar: ' + err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  const saveRecord = async (collection, record) => {
    if (!supabase) {
      setError('Supabase belum terhubung.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const id = record.id || makeId()
      const payload = { ...record }
      delete payload.id

      const { error: saveError } = await supabase
        .from('app_records')
        .upsert(
          {
            collection,
            record_id: id,
            payload
          },
          { onConflict: 'collection,record_id' }
        )

      if (saveError) throw saveError

      await loadData()
      setSuccess('Data berhasil disimpan.')
      setModal(false)
      setEditing(null)
      return true
    } catch (err) {
      setError('Gagal menyimpan data: ' + err.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const deleteRecord = async (collection, id) => {
    if (!isAdmin) {
      setError('Hanya Admin yang dapat menghapus data.')
      return
    }

    if (!window.confirm('Yakin ingin menghapus data ini?')) return

    try {
      const { error: deleteError } = await supabase
        .from('app_records')
        .delete()
        .eq('collection', collection)
        .eq('record_id', id)

      if (deleteError) throw deleteError

      await loadData()
      setSuccess('Data berhasil dihapus.')
    } catch (err) {
      setError('Gagal menghapus data: ' + err.message)
    }
  }

  const getEmptyForm = (collection) => {
    const defaults = {
      customers: { name: '', phone: '', address: '' },
      vehicles: {
        customerId: '',
        plate: '',
        brand: '',
        model: '',
        year: ''
      },
      jobs: {
        customerId: '',
        vehicleId: '',
        date: today(),
        description: '',
        status: 'Menunggu',
        amount: 0
      },
      services: { name: '', description: '', price: 0 },
      products: { name: '', description: '', price: 0, stock: 0 },
      transactions: {
        date: today(),
        description: '',
        amount: 0,
        paymentMethod: 'Tunai',
        customerId: ''
      },
      expenses: {
        date: today(),
        description: '',
        amount: 0,
        category: ''
      }
    }

    return defaults[collection] || {}
  }

  const startAdd = (collection) => {
    setEditing({ collection, id: null })
    setForm(getEmptyForm(collection))
    setModal(true)
  }

  const startEdit = (collection, item) => {
    setEditing({ collection, id: item.id })
    setForm({ ...item })
    setModal(true)
  }

  const todayTransactions = data.transactions.filter(
    (item) => item.date === today()
  )

  const todayRevenue = sum(todayTransactions)

  const recentJobs = [...data.jobs]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 5)

  const customerName = (id) =>
    data.customers.find((item) => item.id === id)?.name || 'Pelanggan umum'

  const vehicleLabel = (id) => {
    const vehicle = data.vehicles.find((item) => item.id === id)

    return vehicle
      ? (vehicle.plate || '-') + ' · ' +
        (vehicle.brand || '') + ' ' + (vehicle.model || '')
      : 'Kendaraan belum dipilih'
  }

  const pageCollection = Object.keys(COLLECTIONS).find(
    (key) => COLLECTIONS[key] === page
  )

  const filteredItems = useMemo(() => {
    if (!pageCollection) return []

    const keyword = search.toLowerCase().trim()
    if (!keyword) return data[pageCollection]

    return data[pageCollection].filter((item) =>
      Object.values(item).some((value) =>
        String(value ?? '').toLowerCase().includes(keyword)
      )
    )
  }, [data, pageCollection, search])

  const submitForm = async (event) => {
    event.preventDefault()
    if (!editing) return

    const collection = editing.collection

    const record = {
      ...form,
      id: editing.id || makeId()
    }

    if (
      ['services', 'products', 'jobs', 'transactions', 'expenses'].includes(
        collection
      )
    ) {
      if (record.amount !== undefined) {
        record.amount = Number(record.amount || 0)
      }

      if (record.price !== undefined) {
        record.price = Number(record.price || 0)
      }

      if (record.stock !== undefined) {
        record.stock = Number(record.stock || 0)
      }
    }

    await saveRecord(collection, record)
  }

  const escapeReceipt = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char])

  
const printReceipt = (transaction, printWindow) => {
  const customer = data.customers.find((item) => item.id === transaction.customerId)
  const vehicle = data.vehicles.find((item) => item.id === transaction.vehicleId)
  const receiptDate = new Date().toLocaleString('id-ID')
  const is80 = settings.receiptPaperWidth === '80'
  const paperWidth = is80 ? '80mm' : '58mm'
  const contentWidth = is80 ? '72mm' : '46mm'

  const vehicleText = vehicle
    ? `${vehicle.brand || ''} ${vehicle.model || ''} / ${vehicle.plate || ''}`.trim()
    : '-'

  const metaRows = [
    ['No. Nota', transaction.id],
    ['Tanggal', transaction.date || receiptDate],
    ...(settings.receiptShowCustomer
      ? [['Pelanggan', customer?.name || 'Pelanggan umum']]
      : []),
    ...(settings.receiptShowVehicle
      ? [['Kendaraan', vehicleText]]
      : [])
  ]

  const metaHtml = metaRows.map(([label, value]) => `
    <div class="meta-row">
      <span class="meta-label">${escapeReceipt(label)}</span>
      <strong class="meta-value">${escapeReceipt(value)}</strong>
    </div>
  `).join('')

  const items = Array.isArray(transaction.items) ? transaction.items : []

  const itemHtml = items.length
    ? items.map((item) => {
        const quantity = Number(item.quantity || 0)
        const unitPrice = Number(item.unitPrice || 0)
        const itemSubtotal = Number(
          item.subtotal ?? quantity * unitPrice
        )

        return `
          <div class="item">
            <div class="item-name">${escapeReceipt(item.name || 'Item')}</div>
            <div class="item-detail">
              <span>${quantity} × ${escapeReceipt(money(unitPrice))}</span>
              <strong>${escapeReceipt(money(itemSubtotal))}</strong>
            </div>
          </div>
        `
      }).join('')
    : `<div class="item-name">${escapeReceipt(transaction.description || 'Pembayaran jasa bengkel')}</div>`

  const subtotal = Number(transaction.subtotal ?? transaction.amount ?? 0)
  const total = Number(transaction.amount ?? subtotal)

    const logoUrl = settings.logoUrl
    ? new URL(settings.logoUrl, window.location.href).href
    : ''

  const logo = settings.receiptShowLogo && logoUrl
    ? `<div class="logo-wrap"><img class="logo" src="${escapeReceipt(logoUrl)}" alt="Logo usaha"></div>`
    : ''

  printWindow.document.open()
  printWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nota ${escapeReceipt(transaction.id)}</title>
<style>
  @page {
    size: ${paperWidth} auto;
    margin: 0;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    width: ${contentWidth};
    margin: 0 auto;
    padding: 0;
}

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    line-height: 1.4;
    color: #111;
    background: #fff;
    padding: 2mm 1mm;
  }

  .center {
    text-align: center;
  }

  .logo-wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 4px;
  }

  .logo {
    display: block;
    max-width: 24mm;
    max-height: 17mm;
    width: auto;
    height: auto;
    object-fit: contain;
    filter: grayscale(100%) contrast(150%);
  }

  .brand {
    font-family: Tahoma, sans-serif;
    font-size: 14px;
    line-height: 1.2;
    font-weight: 700;
    margin-bottom: 3px;
    overflow-wrap: anywhere;
}

  .slogan {
    font-size: 9px;
    margin: 2px 0;
    overflow-wrap: anywhere;
  }

  .muted {
    font-size: 10px;
    font-weight: 600;
    color: #111;
    margin: 3px 0;
    overflow-wrap: anywhere;
  }

  .rule {
    border: 0;
    border-top: 1px dashed #555;
    margin: 6px 0;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 5px;
    margin: 4px 0;
    width: 100%;
  }

  .meta-label {
    flex: 0 0 34%;
    font-size: 10px;
font-weight: 600;
    color: #111;
  }

  .meta-value {
    flex: 1;
    min-width: 0;
    text-align: right;
    font-size: 11px;
    font-weight: 600;
    color: #111;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .section-title {
    font-size: 9px;
    font-weight: 800;
    text-align: center;
    margin: 2px 0 6px;
  }

  .item {
    margin: 7px 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .item-name {
    font-size: 10px;
    font-weight: 700;
    overflow-wrap: anywhere;
    word-break: break-word;
    margin-bottom: 3px;
  }

  .item-detail {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 4px;
    font-size: 9px;
    border-bottom: 1px dotted #aaa;
    padding-bottom: 4px;
  }

  .item-detail span {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .item-detail strong {
    text-align: right;
    overflow-wrap: anywhere;
  }

  .note {
    font-size: 8.5px;
    margin: 5px 0;
    overflow-wrap: anywhere;
  }

  .sum-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 4px;
    margin: 4px 0;
    font-size: 9.5px;
  }

  .sum-row strong {
    text-align: right;
    overflow-wrap: anywhere;
  }

  .total {
    font-family: Tahoma, sans-serif;
    font-size: 13px;
    font-weight: 700;
    border-top: 1px solid #111;
    border-bottom: 1px double #111;
    padding: 5px 0;
    margin: 5px 0;
}

  .thanks {
    font-size: 10px;
    font-weight: 800;
    text-align: center;
    margin: 8px 0 4px;
  }

  .footer {
    text-align: center;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 8.5px;
    margin: 4px 0;
  }

  @media print {
    html, body {
      width: ${contentWidth} !important;
      margin: 0 !important;
      padding: 2mm 1mm !important;
    }

    body {
      -webkit-print-color-adjust: economy;
      print-color-adjust: economy;
      zoom: 1;
    }

    .brand {
      font-size: 15px !important;
      font-weight: 700 !important;
    }

    .item-name {
      font-weight: 400 !important;
    }

    .total,
    .total * {
      font-weight: 800 !important;
    }
  }
  }
</style>
</head>
<body>
  <header class="center">
    ${logo}
    <div class="brand">${escapeReceipt(settings.businessName || 'ATIGA AC MOBIL')}</div>
    ${settings.receiptShowSlogan && settings.slogan ? `<div class="slogan">${escapeReceipt(settings.slogan)}</div>` : ''}
    ${settings.receiptShowAddress && settings.address ? `<div class="muted">${escapeReceipt(settings.address)}</div>` : ''}
    ${settings.receiptShowPhone && settings.phone ? `<div class="muted">${escapeReceipt(settings.phone)}</div>` : ''}
  </header>

  <hr class="rule">
  ${metaHtml}
  <hr class="rule">

  <div class="section-title">RINCIAN PRODUK &amp; JASA</div>
  ${itemHtml}

  <hr class="rule">

  <div class="sum-row">
    <span>Subtotal</span>
    <strong>${escapeReceipt(money(subtotal))}</strong>
  </div>

  <div class="sum-row total">
    <span>TOTAL</span>
    <strong>${escapeReceipt(money(total))}</strong>
  </div>

  <div class="meta-row">
    <span class="meta-label">Pembayaran</span>
    <strong class="meta-value">${escapeReceipt(transaction.paymentMethod || 'Tunai')}</strong>
  </div>

  <div class="meta-row">
    <span class="meta-label">Status</span>
    <strong class="meta-value">${escapeReceipt(transaction.status || 'Lunas')}</strong>
  </div>

  <hr class="rule">

  <div class="thanks">Terima kasih</div>
  <div class="footer">${escapeReceipt(settings.receiptFooter || '')}</div>
  <div class="center muted">Dicetak: ${escapeReceipt(receiptDate)}</div>

  <script>
    window.onload = () => {
      const img = document.querySelector('.logo')
      let printStarted = false

      const doPrint = () => {
        if (printStarted) return
        printStarted = true
        window.focus()
        window.print()
      }

      if (img && !img.complete) {
        img.onload = doPrint
        img.onerror = doPrint
        setTimeout(doPrint, 2500)
      } else {
        doPrint()
      }

      window.onafterprint = () => window.close()
    }
  </script>
</body>
</html>`)

  printWindow.document.close()
}

  const addCashierItem = () => {
    if (!selectedCatalogItem) {
      setError('Pilih produk atau jasa service terlebih dahulu.')
      return
    }
    const [type, selectedId] = selectedCatalogItem.split(':')
    const source = type === 'product' ? data.products : data.services
    const selected = source.find((item) => String(item.id) === selectedId)
    if (!selected) {
      setError('Item tidak ditemukan. Perbarui pilihan produk atau jasa.')
      return
    }
    const unitPrice = Number(selected.price ?? selected.amount ?? 0)
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError('Harga item tidak valid.')
      return
    }
    setCashierCart((items) => [...items, {
      lineId: makeId(), itemId: selected.id, itemType: type,
      name: selected.name || (type === 'product' ? 'Produk' : 'Jasa service'),
      quantity: 1, unitPrice, subtotal: unitPrice
    }])
    setSelectedCatalogItem('')
    setError('')
  }

  const updateCashierItem = (lineId, quantity) => {
    const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1))
    setCashierCart((items) => items.map((item) => item.lineId === lineId
      ? { ...item, quantity: safeQuantity, subtotal: safeQuantity * Number(item.unitPrice || 0) }
      : item))
  }

  const updateCashierPrice = (lineId, price) => {
    const safePrice = Math.max(0, Number(price) || 0)
    setCashierCart((items) => items.map((item) => item.lineId === lineId
      ? { ...item, unitPrice: safePrice, subtotal: safePrice * Number(item.quantity || 1) }
      : item))
  }

  const cashierTotal = cashierCart.reduce((total, item) => total + Number(item.subtotal || 0), 0)

  const submitCashier = async (event) => {
    event.preventDefault()
    if (!cashierCart.length || cashierTotal <= 0) {
      setError('Tambahkan minimal satu produk atau jasa service dengan harga yang benar.')
      return
    }

    // Open the print window during the user gesture so the browser does not block it.
    const printWindow = window.open('', '_blank', 'width=420,height=700')
    if (!printWindow) {
      setError('Jendela cetak diblokir browser. Izinkan pop-up untuk situs ini, lalu ulangi.')
      return
    }

    const itemsSnapshot = cashierCart.map(({ lineId, ...item }) => ({ ...item }))
    const transaction = {
      id: makeId(), date: today(),
      description: cashier.description || itemsSnapshot.map((item) => item.name).join(', '),
      items: itemsSnapshot,
      subtotal: cashierTotal,
      amount: cashierTotal,
      paymentMethod: cashier.paymentMethod,
      customerId: cashier.customerId, vehicleId: cashier.vehicleId,
      status: cashier.status
    }

    const saved = await saveRecord('transactions', transaction)
    if (!saved) {
      printWindow.close()
      return
    }

    printReceipt(transaction, printWindow)
    setCashier({ customerId: '', vehicleId: '', description: '', paymentMethod: 'Tunai', status: 'Lunas' })
    setCashierCart([])
    setSuccess('Transaksi berhasil disimpan. Nota rincian produk dan jasa siap dicetak.')
  }

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - 5 + index)

    const key =
      date.getFullYear().toString() +
      '-' +
      String(date.getMonth() + 1).padStart(2, '0')

    const amount = data.transactions
      .filter((item) => String(item.date || '').startsWith(key))
      .reduce((total, item) => total + Number(item.amount || 0), 0)

    return {
      label: date.toLocaleDateString('id-ID', { month: 'short' }),
      amount
    }
  })

  const maxRevenue = Math.max(...months.map((item) => item.amount), 1)

  const pageTitle = page === 'Dashboard' ? 'Dashboard' : page

  const updateSetting = (key, value) => {
    setSettings((previous) => ({
      ...previous,
      [key]: value
    }))
  }

  return (
    <div
      className={`app-shell layout-${settings.layoutMode || 'auto'}`}
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: '#f4f7fb',
        color: '#17263d',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <aside
        className="app-sidebar"
        style={{
          width: 245,
          minWidth: 245,
          background: settings.primaryColor || '#082d59',
          color: '#fff',
          padding: '22px 14px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            padding: '8px 12px 24px',
            borderBottom: '1px solid rgba(255,255,255,.15)',
            marginBottom: 18
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {settings.businessName || 'ATIGA AC MOBIL'}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {settings.slogan}
          </div>
        </div>

        <div
          style={{
            fontSize: 10,
            opacity: 0.6,
            padding: '0 12px 10px',
            fontWeight: 700
          }}
        >
          MENU UTAMA
        </div>

        <nav style={{ display: 'grid', gap: 5 }}>
          {MENU.filter(
            ([name]) =>
              isAdmin ||
              !['Pengaturan', 'Pengeluaran', 'Laporan'].includes(name)
          ).map(([name, icon]) => (
            <button
              key={name}
              onClick={() => openPage(name)}
              style={{
                border: 0,
                textAlign: 'left',
                padding: '12px 13px',
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: page === name ? 700 : 500,
                background: page === name ? '#1769c2' : 'transparent'
              }}
            >
              <span style={{ display: 'inline-block', width: 27 }}>
                {icon}
              </span>
              {name}
            </button>
          ))}
        </nav>

        <div
          style={{
            marginTop: 'auto',
            padding: '18px 10px 5px',
            borderTop: '1px solid rgba(255,255,255,.15)'
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {profile?.full_name || profile?.email || 'Pengguna'}
          </div>

          <div
            style={{
              fontSize: 11,
              opacity: 0.7,
              margin: '4px 0 13px'
            }}
          >
            {isAdmin ? 'Administrator' : 'Pegawai'}
          </div>

          <button
            onClick={onSignOut}
            style={{
              ...buttonStyle,
              width: '100%',
              background: '#dceaff',
              color: '#123b70'
            }}
          >
            Keluar
          </button>
        </div>
      </aside>

      <main className="app-main" style={{ flex: 1, minWidth: 0, padding: 25 }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 22
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 25,
                color: '#102d61',
                margin: 0
              }}
            >
              {pageTitle}
            </h1>

            <p
              style={{
                margin: '6px 0 0',
                color: '#7b8ba5',
                fontSize: 12
              }}
            >
              {settings.businessName} · {today()}
            </p>
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid #e0e8f3',
              borderRadius: 9,
              padding: '10px 13px',
              fontSize: 12
            }}
          >
            {profile?.full_name || profile?.email}
          </div>
        </header>

        {error && (
          <div
            style={{
              padding: 13,
              marginBottom: 15,
              borderRadius: 8,
              background: '#ffe8e8',
              color: '#a32020',
              fontSize: 13
            }}
          >
            {error}
            <button
              onClick={() => setError('')}
              style={{
                float: 'right',
                border: 0,
                background: 'transparent',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
        )}

        {success && (
          <div
            style={{
              padding: 13,
              marginBottom: 15,
              borderRadius: 8,
              background: '#e2f8eb',
              color: '#087c42',
              fontSize: 13
            }}
          >
            {success}
          </div>
        )}

        {loading ? (
          <div style={cardStyle}>Memuat data bengkel...</div>
        ) : page === 'Dashboard' ? (
          <>
            <section className="dashboard-brand">
              <img
                src={settings.logoUrl}
                alt={settings.businessName}
              />
            </section>

            <section className="dashboard-banner">
              <img
                src={settings.bannerUrl}
                alt={settings.businessName}
              />
            </section>

            <div style={{ ...cardStyle, marginBottom: 18 }}>
              <h2 style={{ margin: '0 0 8px', color: '#102d61' }}>
                {settings.dashboardTitle}
              </h2>
              <p style={{ margin: 0, color: '#71819b' }}>
                {settings.dashboardDescription}
              </p>
              {settings.announcement && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 8,
                    background: '#edf5ff',
                    color: '#174b86'
                  }}
                >
                  {settings.announcement}
                </div>
              )}
            </div>

            <section className="dashboard-stats">
              <div className="dashboard-stat stat-blue">
                <div className="dashboard-stat-icon">🔧</div>
                <div>
                  <span>Transaksi Hari Ini</span>
                  <strong>{todayTransactions.length}</strong>
                  <small>Transaksi tercatat</small>
                </div>
              </div>

              <div className="dashboard-stat stat-green">
                <div className="dashboard-stat-icon">✓</div>
                <div>
                  <span>Pendapatan Hari Ini</span>
                  <strong>{money(todayRevenue)}</strong>
                  <small>Pembayaran masuk hari ini</small>
                </div>
              </div>

              <div className="dashboard-stat stat-orange">
                <div className="dashboard-stat-icon">🚘</div>
                <div>
                  <span>Kendaraan Terdaftar</span>
                  <strong>{data.vehicles.length}</strong>
                  <small>Data kendaraan</small>
                </div>
              </div>

              <div className="dashboard-stat stat-purple">
                <div className="dashboard-stat-icon">♙</div>
                <div>
                  <span>Pelanggan</span>
                  <strong>{data.customers.length}</strong>
                  <small>Data pelanggan</small>
                </div>
              </div>
            </section>

            <section className="dashboard-lower">
              <div
                className="panel dashboard-activity"
                style={{ padding: 18 }}
              >
                <div className="panel-heading">
                  <div>
                    <h3>▥ Aktivitas Pekerjaan</h3>
                    <p>Daftar pekerjaan bengkel terbaru</p>
                  </div>

                  <button
                    className="text-btn"
                    onClick={() => openPage('Uraian Pekerjaan')}
                  >
                    Lihat Semua →
                  </button>
                </div>

                {recentJobs.length ? (
                  recentJobs.map((job) => (
                    <div className="dashboard-job-row" key={job.id}>
                      <div className="dashboard-job-icon">🚘</div>

                      <div className="dashboard-job-info">
                        <b>{vehicleLabel(job.vehicleId)}</b>
                        <span>
                          {customerName(job.customerId)} · {job.date}
                        </span>
                      </div>

                      <span
                        className={
                          'dashboard-status ' +
                          (
                            String(job.status).toLowerCase() === 'selesai'
                              ? 'status-done'
                              : String(job.status).toLowerCase() === 'menunggu'
                                ? 'status-waiting'
                                : 'status-process'
                          )
                        }
                      >
                        {job.status || 'Menunggu'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="empty-block">
                    Belum ada uraian pekerjaan.
                  </div>
                )}
              </div>

              {isAdmin && (
                <div
                  className="panel dashboard-finance"
                  style={{ padding: 18 }}
                >
                  <div className="panel-heading">
                    <div>
                      <h3>◉ Ringkasan Keuangan</h3>
                      <p>Rekap keuangan bengkel</p>
                    </div>
                  </div>

                  <div className="dashboard-finance-total">
                    {money(sum(data.transactions))}
                  </div>

                  <span className="dashboard-finance-caption">
                    Total Pendapatan
                  </span>

                  <div className="dashboard-finance-details">
                    <div>
                      <span>Total Pengeluaran</span>
                      <b>{money(sum(data.expenses))}</b>
                    </div>

                    <div>
                      <span>Selisih Pendapatan</span>
                      <b>
                        {money(
                          sum(data.transactions) - sum(data.expenses)
                        )}
                      </b>
                    </div>
                  </div>

                  <div className="dashboard-chart-title">
                    Pendapatan 6 Bulan Terakhir
                  </div>

                  <div className="dashboard-chart">
                    {months.map((month, index) => (
                      <div
                        className="dashboard-chart-column"
                        key={month.label + '-' + index}
                      >
                        <div className="dashboard-chart-bar-wrap">
                          <div
                            className="dashboard-chart-bar"
                            style={{
                              height:
                                Math.max(
                                  month.amount > 0
                                    ? (month.amount / maxRevenue) * 100
                                    : 3,
                                  3
                                ) + '%'
                            }}
                            title={money(month.amount)}
                          />
                        </div>

                        <span>{month.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </>
        ) : page === 'Kasir' ? (
          <section className="cashier-workspace">
            <div className="cashier-heading">
              <div>
                <h2 style={{ margin: 0, color: '#102d61' }}>POS ATIGA AC MOBIL</h2>
                <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 13 }}>Pilih produk maupun jasa dari satu daftar. Pratinjau nota diperbarui otomatis.</p>
              </div>
              <div className="cashier-mobile-tabs" role="tablist" aria-label="Panel kasir">
                <button type="button" className={cashierMobilePanel === 'input' ? 'active' : ''} onClick={() => setCashierMobilePanel('input')}>Input Kasir</button>
                <button type="button" className={cashierMobilePanel === 'preview' ? 'active' : ''} onClick={() => setCashierMobilePanel('preview')}>Preview Nota</button>
              </div>
            </div>
            <div className="cashier-split-layout">
              <form className={`cashier-entry-panel ${cashierMobilePanel === 'input' ? 'mobile-panel-active' : ''}`} onSubmit={submitCashier}>
                <div className="cashier-form-card">
                  <h3>Data pelanggan & kendaraan</h3>
                  <div className="cashier-fields-grid">
                    <label><span>Pelanggan</span><select style={inputStyle} value={cashier.customerId} onChange={(e) => setCashier({ ...cashier, customerId: e.target.value, vehicleId: '' })}><option value="">Pelanggan umum</option>{data.customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                    <label><span>Kendaraan</span><select style={inputStyle} value={cashier.vehicleId} onChange={(e) => setCashier({ ...cashier, vehicleId: e.target.value })}><option value="">Pilih kendaraan</option>{data.vehicles.filter((item) => !cashier.customerId || item.customerId === cashier.customerId).map((item) => <option key={item.id} value={item.id}>{item.plate} - {item.brand} {item.model}</option>)}</select></label>
                  </div>
                </div>

                <div className="cashier-form-card">
                  <h3>Tambah produk / jasa service</h3>
                  <div className="cashier-add-row">
                    <select style={inputStyle} value={selectedCatalogItem} onChange={(e) => setSelectedCatalogItem(e.target.value)}>
                      <option value="">Pilih produk atau jasa service</option>
                      <optgroup label="Produk">{data.products.map((item) => <option key={`product-${item.id}`} value={`product:${item.id}`}>Produk · {item.name} — {money(item.price)}</option>)}</optgroup>
                      <optgroup label="Jasa service">{data.services.map((item) => <option key={`service-${item.id}`} value={`service:${item.id}`}>Jasa · {item.name} — {money(item.price ?? item.amount)}</option>)}</optgroup>
                    </select>
                    <button type="button" style={buttonStyle} onClick={addCashierItem}>＋ Tambahkan</button>
                  </div>
                  {!data.products.length && !data.services.length && <small style={{ color: '#b45309' }}>Belum ada produk maupun jasa. Tambahkan data melalui menu Produk atau Layanan.</small>}
                </div>

                <div className="cashier-form-card cashier-cart-card">
                  <div className="cashier-cart-title"><h3>Daftar belanja</h3><span>{cashierCart.length} baris</span></div>
                  {cashierCart.length === 0 ? <div className="cashier-empty-cart">Belum ada produk atau jasa yang ditambahkan.</div> : (
                    <div className="cashier-cart-list">
                      {cashierCart.map((item) => <div className="cashier-cart-item" key={item.lineId}>
                        <div className="cashier-cart-item-heading"><div><strong>{item.name}</strong><small>{item.itemType === 'product' ? 'Produk' : 'Jasa service'}</small></div><button type="button" className="cashier-remove-button" onClick={() => setCashierCart((items) => items.filter((row) => row.lineId !== item.lineId))}>Hapus</button></div>
                        <div className="cashier-item-edit-grid">
                          <label><span>Harga satuan (Rp)</span><input aria-label={`Harga satuan ${item.name}`} type="number" min="0" step="500" value={item.unitPrice} onChange={(e) => updateCashierPrice(item.lineId, e.target.value)} style={inputStyle} /></label>
                          <label><span>Jumlah</span><input aria-label={`Jumlah ${item.name}`} type="number" min="1" step="1" value={item.quantity} onChange={(e) => updateCashierItem(item.lineId, e.target.value)} style={inputStyle} /></label>
                          <div className="cashier-item-subtotal"><span>Subtotal</span><strong>{money(item.subtotal)}</strong></div>
                        </div>
                      </div>)}
                    </div>
                  )}
                </div>

                <div className="cashier-form-card">
                  <label className="cashier-note-field"><span>Catatan transaksi (opsional)</span><input style={inputStyle} value={cashier.description} onChange={(e) => setCashier({ ...cashier, description: e.target.value })} placeholder="Contoh: Keluhan AC kurang dingin" /></label>
                  <div className="cashier-fields-grid cashier-payment-grid">
                    <label><span>Metode pembayaran</span><select style={inputStyle} value={cashier.paymentMethod} onChange={(e) => setCashier({ ...cashier, paymentMethod: e.target.value })}><option>Tunai</option><option>Transfer</option><option>QRIS</option></select></label>
                    <label><span>Status pembayaran</span><select style={inputStyle} value={cashier.status} onChange={(e) => setCashier({ ...cashier, status: e.target.value })}><option>Lunas</option><option>Belum Lunas</option><option>DP</option></select></label>
                  </div>
                  <div className="cashier-total-strip"><span>{cashierCart.reduce((n, item) => n + Number(item.quantity || 0), 0)} item</span><strong>{money(cashierTotal)}</strong></div>
                  <button className="cashier-submit-button" style={buttonStyle} disabled={saving || cashierCart.length === 0}>{saving ? 'Menyimpan...' : 'Simpan & Cetak Nota 58 mm'}</button>
                </div>
              </form>

              <aside className={`cashier-preview-panel ${cashierMobilePanel === 'preview' ? 'mobile-panel-active' : ''}`}>
                <div className="cashier-preview-heading"><div><h3>Preview Nota</h3><span>Pratinjau langsung · Thermal {settings.receiptPaperWidth || '58'} mm</span></div><span className="cashier-live-indicator">LIVE</span></div>
                <div className="cashier-paper-wrap">
                  <div className={`cashier-paper ${settings.receiptPaperWidth === '80' ? 'paper-80' : 'paper-58'}`}>
                    {settings.receiptShowLogo && settings.logoUrl && <img className="cashier-paper-logo" src={settings.logoUrl} alt="Logo usaha" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
                    <h2>{settings.businessName || 'ATIGA AC MOBIL'}</h2>
                    {settings.receiptShowSlogan && settings.slogan && <p>{settings.slogan}</p>}
                    {settings.receiptShowAddress && settings.address && <p>{settings.address}</p>}
                    {settings.receiptShowPhone && settings.phone && <p>{settings.phone}</p>}
                    <div className="cashier-paper-rule" />
                    <div className="cashier-paper-meta"><span>No. Nota</span><b>Terbentuk saat disimpan</b></div>
                    <div className="cashier-paper-meta"><span>Tanggal</span><b>{new Date().toLocaleDateString('id-ID')}</b></div>
                    {settings.receiptShowCustomer && <div className="cashier-paper-meta"><span>Pelanggan</span><b>{data.customers.find((x) => x.id === cashier.customerId)?.name || 'Pelanggan umum'}</b></div>}
                    {settings.receiptShowVehicle && <div className="cashier-paper-meta"><span>Kendaraan</span><b>{(() => { const v = data.vehicles.find((x) => x.id === cashier.vehicleId); return v ? `${v.brand || ''} ${v.model || ''} / ${v.plate || ''}` : '-' })()}</b></div>}
                    <div className="cashier-paper-rule" />
                    <strong className="cashier-paper-section-title">RINCIAN PRODUK & JASA</strong>
                    {cashierCart.length === 0 ? <p className="cashier-paper-empty">Rincian transaksi akan tampil di sini setelah item ditambahkan.</p> : cashierCart.map((item) => <div className="cashier-paper-line-item" key={item.lineId}><b>{item.name}</b><div><span>{item.quantity} × {money(item.unitPrice)}</span><strong>{money(item.subtotal)}</strong></div></div>)}
                    {cashier.description && <p className="cashier-paper-note">Catatan: {cashier.description}</p>}
                    <div className="cashier-paper-rule" />
                    <div className="cashier-paper-meta"><span>Subtotal</span><b>{money(cashierTotal)}</b></div>
                    <div className="cashier-paper-total"><span>TOTAL</span><strong>{money(cashierTotal)}</strong></div>
                    <div className="cashier-paper-meta"><span>Pembayaran</span><b>{cashier.paymentMethod}</b></div>
                    <div className="cashier-paper-meta"><span>Status</span><b>{cashier.status}</b></div>
                    <div className="cashier-paper-rule" />
                    <p className="cashier-paper-thanks">Terima kasih</p><p className="cashier-paper-footer">{settings.receiptFooter || DEFAULT_SETTINGS.receiptFooter}</p>
                  </div>
                </div>
                <p className="cashier-preview-hint">Tampilan ini mengikuti rincian transaksi dan pengaturan nota. Hasil cetak dapat sedikit berbeda mengikuti driver printer thermal.</p>
              </aside>
            </div>
          </section>
        ) : pageCollection ? (
          <section style={cardStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 18
              }}
            >
              <input
                style={{ ...inputStyle, maxWidth: 330 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={'Cari ' + page.toLowerCase() + '...'}
              />

              <button
                style={buttonStyle}
                onClick={() => startAdd(pageCollection)}
              >
                + Tambah {page}
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 13,
                  minWidth: 650
                }}
              >
                <thead>
                  <tr style={{ background: '#f1f5fb', textAlign: 'left' }}>
                    <th style={tableCell}>No.</th>

                    {getColumns(pageCollection).map((column) => (
                      <th style={tableCell} key={column.key}>
                        {column.label}
                      </th>
                    ))}

                    <th style={tableCell}>Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.map((item, index) => (
                    <tr key={item.id}>
                      <td style={tableCell}>{index + 1}</td>

                      {getColumns(pageCollection).map((column) => (
                        <td style={tableCell} key={column.key}>
                          {formatCell(item, column.key, money)}
                        </td>
                      ))}

                      <td style={tableCell}>
                        <button
                          onClick={() => startEdit(pageCollection, item)}
                          style={{
                            ...buttonStyle,
                            padding: '7px 10px',
                            marginRight: 6
                          }}
                        >
                          Edit
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() =>
                              deleteRecord(pageCollection, item.id)
                            }
                            style={{
                              ...buttonStyle,
                              padding: '7px 10px',
                              background: '#d94343'
                            }}
                          >
                            Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {!filteredItems.length && (
                    <tr>
                      <td
                        style={tableCell}
                        colSpan={getColumns(pageCollection).length + 2}
                      >
                        Belum ada data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : page === 'Laporan' ? (
          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Laporan Keuangan</h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
                gap: 14
              }}
            >
              <SummaryCard
                title="Total Pendapatan"
                value={money(sum(data.transactions))}
              />

              <SummaryCard
                title="Total Pengeluaran"
                value={money(sum(data.expenses))}
              />

              <SummaryCard
                title="Selisih"
                value={money(
                  sum(data.transactions) - sum(data.expenses)
                )}
              />
            </div>

            <p style={{ color: '#71819b', fontSize: 13 }}>
              Laporan dihitung berdasarkan seluruh transaksi dan pengeluaran
              yang tersimpan.
            </p>
          </section>
        ) : page === 'Pengaturan' ? (
          <section className="settings-page">
            <div className="settings-header">
              <div className="settings-icon">⚙</div>
              <div>
                <h2>Pengaturan Aplikasi</h2>
                <p>Kelola identitas usaha dan tampilan ATIGA AC MOBIL</p>
              </div>
            </div>

            {!isAdmin ? (
              <div className="settings-card">
                Pengaturan hanya dapat diakses oleh Administrator.
              </div>
            ) : (
              <>
                <div className="settings-card">
                  <div className="settings-card-title">
                    <span>🏢</span>
                    Detail Usaha
                  </div>

                  <div style={{ display: 'grid', gap: 13 }}>
                    <SettingInput
                      label="Nama Usaha"
                      value={settings.businessName}
                      onChange={(value) =>
                        updateSetting('businessName', value)
                      }
                    />

                    <SettingInput
                      label="Slogan / Keterangan Usaha"
                      value={settings.slogan}
                      onChange={(value) => updateSetting('slogan', value)}
                    />

                    <SettingInput
                      label="Alamat Usaha"
                      value={settings.address}
                      onChange={(value) => updateSetting('address', value)}
                    />

                    <SettingInput
                      label="Nomor Telepon / WhatsApp"
                      value={settings.phone}
                      onChange={(value) => updateSetting('phone', value)}
                    />

                    <SettingInput
                      label="Email Usaha"
                      value={settings.email}
                      onChange={(value) => updateSetting('email', value)}
                    />
                  </div>
                </div>

                <div className="settings-card">
                  <div className="settings-card-title">
                    <span>🖼️</span>
                    Logo Usaha
                  </div>

                  <div className="settings-logo-preview-wrap">
                    {settings.logoUrl ? <img src={settings.logoUrl} alt="Pratinjau logo usaha" className="settings-logo-preview" onError={(e) => { e.currentTarget.alt = 'Logo tidak dapat dimuat. Silakan unggah ulang.' }} /> : <div className="settings-logo-empty">Belum ada logo usaha</div>}
                    <div><b>Pratinjau logo usaha</b><p>Logo ini digunakan pada bagian atas nota jika opsi “Tampilkan logo usaha” diaktifkan.</p></div>
                  </div>

                  <label className="logo-upload-control" style={uploadLabelStyle}>
                    <span>{uploadingImage ? 'Mengunggah logo...' : 'Pilih Logo dari Komputer'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      disabled={uploadingImage}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) uploadSettingsImage(file, 'logo')
                        event.target.value = ''
                      }}
                      style={{ display: 'block', width: '100%', marginTop: 9 }}
                    />
                    <small>Format JPG, PNG, WebP atau GIF · Maksimal 4 MB · Admin</small>
                  </label>
                </div>

                <div className="settings-card">
                  <div className="settings-card-title">
                    <span>🌄</span>
                    Banner Dashboard
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <img
                      src={settings.bannerUrl}
                      alt="Pratinjau banner"
                      style={{
                        width: '100%',
                        maxHeight: 220,
                        objectFit: 'cover',
                        border: '1px solid #e1e8f2',
                        borderRadius: 10
                      }}
                    />
                  </div>

                  <label style={uploadLabelStyle}>
                    Pilih Banner dari Komputer
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingImage}
                      onChange={(event) => {
                        uploadSettingsImage(event.target.files?.[0], 'banner')
                        event.target.value = ''
                      }}
                      style={{ display: 'block', marginTop: 9 }}
                    />
                  </label>

                  {uploadingImage && (
                    <p style={{ color: '#0860dc', fontSize: 13 }}>
                      Sedang mengunggah gambar...
                    </p>
                  )}
                </div>

                <div className="settings-card">
                  <div className="settings-card-title">
                    <span>✍️</span>
                    Tulisan Dashboard
                  </div>

                  <div style={{ display: 'grid', gap: 13 }}>
                    <SettingInput
                      label="Judul Dashboard"
                      value={settings.dashboardTitle}
                      onChange={(value) =>
                        updateSetting('dashboardTitle', value)
                      }
                    />

                    <SettingInput
                      label="Deskripsi / Sambutan"
                      value={settings.dashboardDescription}
                      onChange={(value) =>
                        updateSetting('dashboardDescription', value)
                      }
                      multiline
                    />

                    <SettingInput
                      label="Pengumuman atau Informasi Tambahan"
                      value={settings.announcement}
                      onChange={(value) =>
                        updateSetting('announcement', value)
                      }
                      multiline
                      required={false}
                    />
                  </div>
                </div>

                <div className="settings-card receipt-settings-card">
                  <div className="settings-card-title"><span>🧾</span> Pengaturan Nota / Struk Kasir</div>
                  <p style={{ color: '#64748b', fontSize: 13, marginTop: 0 }}>Atur identitas, logo, ukuran kertas, dan pesan penutup yang akan dicetak pada nota transaksi.</p>
                  <div style={{ display: 'grid', gap: 14 }}>
                    <label style={{ display: 'grid', gap: 6 }}><span style={{ fontSize: 13, fontWeight: 700 }}>Ukuran kertas printer thermal</span>
                      <select value={settings.receiptPaperWidth || '58'} onChange={(e) => updateSetting('receiptPaperWidth', e.target.value)} style={inputStyle}><option value="58">58 mm</option><option value="80">80 mm</option></select>
                    </label>
                    <label style={{ display: 'grid', gap: 6 }}><span style={{ fontSize: 13, fontWeight: 700 }}>Pesan penutup / moto pada struk</span>
                      <textarea rows={3} value={settings.receiptFooter ?? DEFAULT_SETTINGS.receiptFooter} onChange={(e) => updateSetting('receiptFooter', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Terima kasih telah mempercayakan kendaraan Anda kepada kami." />
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 9 }}>
                      {[["receiptShowLogo","Tampilkan logo usaha"],["receiptShowSlogan","Tampilkan moto / slogan"],["receiptShowAddress","Tampilkan alamat"],["receiptShowPhone","Tampilkan nomor HP / WhatsApp"],["receiptShowCustomer","Tampilkan data pelanggan"],["receiptShowVehicle","Tampilkan data kendaraan"]].map(([key,label]) => <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: 10, border: '1px solid #e1e8f2', borderRadius: 9, fontSize: 13 }}><input type="checkbox" checked={settings[key] ?? DEFAULT_SETTINGS[key]} onChange={(e) => updateSetting(key,e.target.checked)} />{label}</label>)}
                    </div>
                    <div style={{ background: '#f4f7fb', padding: 13, borderRadius: 10, fontSize: 12, color: '#52627a' }}><b>Catatan:</b> Logo mengikuti gambar pada bagian Logo Usaha di atas. Pastikan ukuran kertas di pengaturan printer Windows sama dengan pilihan di sini. Tekan <b>Simpan Pengaturan</b> agar perubahan tersimpan.</div>
                  </div>
                </div>

                <PrinterSettings />

                <div className="settings-card responsive-settings-card">
                  <div className="settings-card-title">
                    <span>📱</span>
                    Tampilan Desktop dan HP
                  </div>
                  <p className="responsive-settings-description">
                    Atur bagaimana aplikasi ditampilkan pada komputer, tablet, Android, dan iPhone.
                  </p>
                  <label className="responsive-setting-field">
                    <span>Mode tampilan aplikasi</span>
                    <select
                      value={settings.layoutMode || 'auto'}
                      onChange={(event) => updateSetting('layoutMode', event.target.value)}
                      style={inputStyle}
                    >
                      <option value="auto">Otomatis mengikuti ukuran layar (disarankan)</option>
                      <option value="mobile">Mode HP / Mobile</option>
                      <option value="desktop">Mode Desktop</option>
                    </select>
                  </label>
                  <p className="responsive-settings-hint">
                    Otomatis akan menyesuaikan menu dan ruang kerja berdasarkan ukuran layar. Pilihan akan tersimpan setelah menekan Simpan Pengaturan.
                  </p>
                </div>

                <div className="settings-card">
                  <div className="settings-card-title">
                    <span>🎨</span>
                    Warna Tampilan
                  </div>

                  <label style={{ display: 'grid', gap: 9 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      Warna utama menu samping
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12
                      }}
                    >
                      <input
                        type="color"
                        value={settings.primaryColor || '#082d59'}
                        onChange={(event) =>
                          updateSetting('primaryColor', event.target.value)
                        }
                        style={{
                          width: 55,
                          height: 42,
                          border: 0,
                          cursor: 'pointer'
                        }}
                      />
                      <strong>{settings.primaryColor}</strong>
                    </div>
                  </label>
                </div>

                <div
                  className="settings-card"
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 10,
                    flexWrap: 'wrap'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSettings(DEFAULT_SETTINGS)}
                    style={{
                      ...buttonStyle,
                      background: '#e8eef7',
                      color: '#34445c'
                    }}
                  >
                    Kembalikan Awal
                  </button>

                  <button
                    type="button"
                    onClick={saveSettings}
                    disabled={saving || uploadingImage}
                    style={buttonStyle}
                  >
                    {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                  </button>
                </div>

                <div className="settings-card">
                  <div className="settings-card-title">
                    <span>👤</span>
                    Informasi Pengguna
                  </div>

                  <div className="settings-info-row">
                    <span>Pengguna</span>
                    <strong>
                      {profile?.email || profile?.full_name || '-'}
                    </strong>
                  </div>

                  <div className="settings-info-row">
                    <span>Hak akses</span>
                    <strong className="settings-admin">Admin</strong>
                  </div>
                </div>

                <div className="settings-card settings-security">
                  <div className="settings-card-title">
                    <span>🔐</span>
                    Pengelolaan Akun Pegawai
                  </div>

                  <p>
                    Pengelolaan akun pegawai tetap dilakukan melalui sistem
                    autentikasi Supabase yang sudah tersedia.
                  </p>
                </div>
              </>
            )}
          </section>
        ) : null}
      </main>

      {modal && editing && (
        <div
          onClick={() => setModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 25, 50, .55)',
            display: 'grid',
            placeItems: 'center',
            padding: 15,
            zIndex: 1000
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(100%, 520px)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#fff',
              borderRadius: 14,
              padding: 22,
              boxSizing: 'border-box'
            }}
          >
            <h2 style={{ marginTop: 0, color: '#102d61' }}>
              {editing.id ? 'Edit' : 'Tambah'}{' '}
              {COLLECTIONS[editing.collection]}
            </h2>

            <form
              onSubmit={submitForm}
              style={{ display: 'grid', gap: 13 }}
            >
              {getColumns(editing.collection).map((column) => (
                <label key={column.key}>
                  <div
                    style={{
                      marginBottom: 6,
                      fontSize: 13,
                      fontWeight: 600
                    }}
                  >
                    {column.label}
                  </div>

                  {column.key === 'customerId' ? (
                    <select
                      style={inputStyle}
                      value={form.customerId || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          customerId: e.target.value
                        })
                      }
                    >
                      <option value="">Pilih pelanggan</option>
                      {data.customers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  ) : column.key === 'vehicleId' ? (
                    <select
                      style={inputStyle}
                      value={form.vehicleId || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          vehicleId: e.target.value
                        })
                      }
                    >
                      <option value="">Pilih kendaraan</option>
                      {data.vehicles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.plate} - {item.brand} {item.model}
                        </option>
                      ))}
                    </select>
                  ) : column.key === 'status' ? (
                    <select
                      style={inputStyle}
                      value={form.status || 'Menunggu'}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          status: e.target.value
                        })
                      }
                    >
                      <option>Menunggu</option>
                      <option>Diproses</option>
                      <option>Selesai</option>
                    </select>
                  ) : column.key === 'paymentMethod' ? (
                    <select
                      style={inputStyle}
                      value={form.paymentMethod || 'Tunai'}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          paymentMethod: e.target.value
                        })
                      }
                    >
                      <option>Tunai</option>
                      <option>Transfer</option>
                      <option>QRIS</option>
                    </select>
                  ) : (
                    <input
                      style={inputStyle}
                      type={column.type || 'text'}
                      value={form[column.key] ?? ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [column.key]: e.target.value
                        })
                      }
                      required={column.required !== false}
                    />
                  )}
                </label>
              ))}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 9,
                  marginTop: 8
                }}
              >
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  style={{
                    ...buttonStyle,
                    background: '#e8eef7',
                    color: '#34445c'
                  }}
                >
                  Batal
                </button>

                <button style={buttonStyle} disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const tableCell = {
  padding: '12px 10px',
  borderBottom: '1px solid #e6edf5',
  verticalAlign: 'top'
}

const uploadLabelStyle = {
  display: 'block',
  padding: 13,
  border: '1px dashed #9bb5d5',
  borderRadius: 9,
  background: '#f7faff',
  color: '#174b86',
  fontSize: 13,
  fontWeight: 600
}

function SettingInput({
  label,
  value,
  onChange,
  multiline = false,
  required = true
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>

      {multiline ? (
        <textarea
          style={{
            ...inputStyle,
            minHeight: 85,
            resize: 'vertical',
            fontFamily: 'Arial, sans-serif'
          }}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          required={required}
        />
      ) : (
        <input
          style={inputStyle}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          required={required}
        />
      )}
    </label>
  )
}

function getColumns(collection) {
  const columns = {
    customers: [
      { key: 'name', label: 'Nama Pelanggan' },
      { key: 'phone', label: 'Nomor Telepon' },
      { key: 'address', label: 'Alamat' }
    ],
    vehicles: [
      { key: 'plate', label: 'Nomor Polisi' },
      { key: 'brand', label: 'Merek' },
      { key: 'model', label: 'Model' },
      { key: 'customerId', label: 'Pelanggan' }
    ],
    jobs: [
      { key: 'date', label: 'Tanggal', type: 'date' },
      { key: 'customerId', label: 'Pelanggan' },
      { key: 'vehicleId', label: 'Kendaraan' },
      { key: 'description', label: 'Uraian Pekerjaan' },
      { key: 'amount', label: 'Biaya', type: 'number' },
      { key: 'status', label: 'Status' }
    ],
    services: [
      { key: 'name', label: 'Nama Layanan' },
      { key: 'description', label: 'Keterangan' },
      { key: 'price', label: 'Harga', type: 'number' }
    ],
    products: [
      { key: 'name', label: 'Nama Produk' },
      { key: 'description', label: 'Keterangan' },
      { key: 'price', label: 'Harga', type: 'number' },
      { key: 'stock', label: 'Stok', type: 'number' }
    ],
    transactions: [
      { key: 'date', label: 'Tanggal', type: 'date' },
      { key: 'description', label: 'Keterangan' },
      { key: 'amount', label: 'Jumlah', type: 'number' },
      { key: 'paymentMethod', label: 'Metode Pembayaran' }
    ],
    expenses: [
      { key: 'date', label: 'Tanggal', type: 'date' },
      { key: 'category', label: 'Kategori' },
      { key: 'description', label: 'Keterangan' },
      { key: 'amount', label: 'Jumlah', type: 'number' }
    ]
  }

  return columns[collection] || []
}

function formatCell(item, key, formatMoney) {
  if (key === 'customerId') return item.customerId || '-'
  if (key === 'vehicleId') return item.vehicleId || '-'
  if (['amount', 'price'].includes(key)) return formatMoney(item[key])
  return item[key] || '-'
}

function SummaryCard({ title, value }) {
  return (
    <div
      style={{
        padding: 18,
        background: '#f2f6fc',
        borderRadius: 10
      }}
    >
      <div style={{ color: '#71819b', fontSize: 13 }}>{title}</div>

      <strong
        style={{
          display: 'block',
          marginTop: 9,
          color: '#123d76',
          fontSize: 21
        }}
      >
        {value}
      </strong>
    </div>
  )
}

export default App
