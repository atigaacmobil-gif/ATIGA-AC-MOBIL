
import { useEffect, useMemo, useState } from 'react'
import AuthGate from './AuthGate'
import { supabase } from './supabase'
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
  primaryColor: '#082d59'
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
    amount: '',
    paymentMethod: 'Tunai',
    status: 'Lunas'
  })

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
      setError('File harus berupa gambar.')
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

      const imageUrl = publicData.publicUrl

      setSettings((previous) => ({
        ...previous,
        [type === 'logo' ? 'logoUrl' : 'bannerUrl']: imageUrl
      }))

      setSuccess(
        'Gambar berhasil diunggah. Klik Simpan Pengaturan untuk menyimpan perubahan.'
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
    } catch (err) {
      setError('Gagal menyimpan data: ' + err.message)
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

  const submitCashier = async (event) => {
    event.preventDefault()

    const amount = Number(cashier.amount)

    if (!amount || amount <= 0) {
      setError('Masukkan jumlah pembayaran yang benar.')
      return
    }

    const transaction = {
      id: makeId(),
      date: today(),
      description: cashier.description || 'Pembayaran jasa bengkel',
      amount,
      paymentMethod: cashier.paymentMethod,
      customerId: cashier.customerId,
      vehicleId: cashier.vehicleId,
      status: cashier.status
    }

    await saveRecord('transactions', transaction)

    setCashier({
      customerId: '',
      vehicleId: '',
      description: '',
      amount: '',
      paymentMethod: 'Tunai',
      status: 'Lunas'
    })
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
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: '#f4f7fb',
        color: '#17263d',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <aside
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

      <main style={{ flex: 1, minWidth: 0, padding: 25 }}>
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
          <section style={{ ...cardStyle, maxWidth: 700 }}>
            <h2 style={{ marginTop: 0, color: '#102d61' }}>
              Pembayaran Kasir
            </h2>

            <form
              onSubmit={submitCashier}
              style={{ display: 'grid', gap: 14 }}
            >
              <label>
                <div style={{ marginBottom: 6, fontSize: 13 }}>
                  Pelanggan
                </div>

                <select
                  style={inputStyle}
                  value={cashier.customerId}
                  onChange={(e) =>
                    setCashier({
                      ...cashier,
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
              </label>

              <label>
                <div style={{ marginBottom: 6, fontSize: 13 }}>
                  Kendaraan
                </div>

                <select
                  style={inputStyle}
                  value={cashier.vehicleId}
                  onChange={(e) =>
                    setCashier({
                      ...cashier,
                      vehicleId: e.target.value
                    })
                  }
                >
                  <option value="">Pilih kendaraan</option>
                  {data.vehicles
                    .filter(
                      (item) =>
                        !cashier.customerId ||
                        item.customerId === cashier.customerId
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.plate} - {item.brand} {item.model}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <div style={{ marginBottom: 6, fontSize: 13 }}>
                  Keterangan pembayaran
                </div>

                <input
                  style={inputStyle}
                  value={cashier.description}
                  onChange={(e) =>
                    setCashier({
                      ...cashier,
                      description: e.target.value
                    })
                  }
                  placeholder="Contoh: Service AC dan isi freon"
                  required
                />
              </label>

              <label>
                <div style={{ marginBottom: 6, fontSize: 13 }}>
                  Jumlah pembayaran (Rp)
                </div>

                <input
                  style={inputStyle}
                  type="number"
                  min="1"
                  value={cashier.amount}
                  onChange={(e) =>
                    setCashier({
                      ...cashier,
                      amount: e.target.value
                    })
                  }
                  required
                />
              </label>

              <label>
                <div style={{ marginBottom: 6, fontSize: 13 }}>
                  Metode pembayaran
                </div>

                <select
                  style={inputStyle}
                  value={cashier.paymentMethod}
                  onChange={(e) =>
                    setCashier({
                      ...cashier,
                      paymentMethod: e.target.value
                    })
                  }
                >
                  <option>Tunai</option>
                  <option>Transfer</option>
                  <option>QRIS</option>
                </select>
              </label>

              <label>
                <div style={{ marginBottom: 6, fontSize: 13 }}>
                  Status pembayaran
                </div>

                <select
                  style={inputStyle}
                  value={cashier.status}
                  onChange={(e) =>
                    setCashier({
                      ...cashier,
                      status: e.target.value
                    })
                  }
                >
                  <option>Lunas</option>
                  <option>Belum Lunas</option>
                  <option>DP</option>
                </select>
              </label>

              <button style={buttonStyle} disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan Pembayaran'}
              </button>
            </form>
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

                  <div style={{ marginBottom: 14 }}>
                    <img
                      src={settings.logoUrl}
                      alt="Pratinjau logo"
                      style={{
                        width: 130,
                        height: 130,
                        objectFit: 'contain',
                        border: '1px solid #e1e8f2',
                        borderRadius: 10,
                        padding: 8,
                        background: '#fff'
                      }}
                    />
                  </div>

                  <label style={uploadLabelStyle}>
                    Pilih Logo dari Komputer
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingImage}
                      onChange={(event) => {
                        uploadSettingsImage(event.target.files?.[0], 'logo')
                        event.target.value = ''
                      }}
                      style={{ display: 'block', marginTop: 9 }}
                    />
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
