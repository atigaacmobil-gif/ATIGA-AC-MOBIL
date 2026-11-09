import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from './supabase'

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [needsPassword, setNeedsPassword] = useState(() => window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery'))
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const loadProfile = async (user) => {
    if (!user) { setProfile(null); return }
    let result = await supabase.from('profiles').select('id,email,full_name,role,active').eq('id', user.id).maybeSingle()
    if (result.error) throw result.error
    if (!result.data) throw new Error('Profil akun belum tersedia. Pastikan SQL Supabase sudah dijalankan.')
    if (!result.data.active) {
      await supabase.auth.signOut()
      throw new Error('Akun ini dinonaktifkan. Hubungi administrator bengkel.')
    }
    setProfile(result.data)
  }

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return undefined }
    let alive = true
    const init = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) setMessage(error.message)
      if (alive && data.session) {
        setSession(data.session)
        try { await loadProfile(data.session.user) } catch (err) { setMessage(err.message); await supabase.auth.signOut() }
      }
      if (alive) setLoading(false)
    }
    init()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) setProfile(null)
      else window.setTimeout(() => loadProfile(nextSession.user).catch((err) => setMessage(err.message)), 0)
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return undefined
    const channel = supabase.channel(`atiga-profile-${session.user.id}`).on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}`,
    }, () => {
      loadProfile(session.user).catch(async (error) => { setMessage(error.message); await supabase.auth.signOut() })
    }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session?.user?.id])

  const signIn = async (event) => {
    event.preventDefault(); setBusy(true); setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setMessage(error.message)
    setBusy(false)
  }

  const signOut = async () => { await supabase.auth.signOut(); setSession(null); setProfile(null); setNeedsPassword(false) }
  const saveNewPassword = async (event) => {
    event.preventDefault()
    if (newPassword.length < 8) return setMessage('Kata sandi minimal 8 karakter.')
    if (newPassword !== confirmPassword) return setMessage('Konfirmasi kata sandi tidak sama.')
    setBusy(true); setMessage('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setMessage(error.message)
    else { setNeedsPassword(false); window.history.replaceState({}, document.title, window.location.pathname); setMessage('Kata sandi berhasil dibuat.') }
    setBusy(false)
  }

  if (!isSupabaseConfigured) return <div className="auth-page"><div className="auth-card"><div className="auth-logo">A</div><h1>ATIGA AC MOBIL</h1><h2>Hubungkan database online</h2><p>Aplikasi membutuhkan alamat proyek Supabase dan kunci publik sebelum dapat digunakan bersama di banyak perangkat.</p><ol><li>Buat file <code>.env</code> di folder utama proyek.</li><li>Isi <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code>.</li><li>Jalankan ulang server Vite.</li></ol><p className="auth-hint">Contoh format tersedia di file <code>.env.example</code>.</p></div></div>
  if (loading) return <div className="auth-page"><div className="auth-card">Memeriksa sesi akun...</div></div>
  if (!session) return <div className="auth-page"><form className="auth-card" onSubmit={signIn}><div className="auth-logo">A</div><h1>ATIGA AC MOBIL</h1><h2>Masuk ke aplikasi</h2><p>Gunakan akun Admin atau Pegawai yang sudah dibuat oleh administrator.</p><label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /></label><label className="field"><span>Kata sandi</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>{message && <div className="auth-message">{message}</div>}<button className="primary full" disabled={busy}>{busy ? 'Memproses...' : 'Masuk'}</button><p className="auth-hint">Akun pegawai dibuat atau diundang oleh Admin melalui pengelolaan akun Supabase.</p></form></div>
  if (!profile) return <div className="auth-page"><div className="auth-card"><h2>Menyiapkan akun...</h2><p>Memuat hak akses pengguna.</p>{message && <div className="auth-message">{message}</div>}<button className="secondary" onClick={signOut}>Keluar</button></div></div>
  if (needsPassword) return <div className="auth-page"><form className="auth-card" onSubmit={saveNewPassword}><div className="auth-logo">A</div><h1>ATIGA AC MOBIL</h1><h2>Buat kata sandi akun</h2><p>Atur kata sandi pribadi untuk mulai menggunakan akun pegawai.</p><label className="field"><span>Kata sandi baru</span><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required autoComplete="new-password" /></label><label className="field"><span>Ulangi kata sandi</span><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required autoComplete="new-password" /></label>{message && <div className="auth-message">{message}</div>}<button className="primary full" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan Kata Sandi'}</button></form></div>
  return children({ session, profile, onSignOut: signOut })
}
