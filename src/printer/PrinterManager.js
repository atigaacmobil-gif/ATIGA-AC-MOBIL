import {
  DEFAULT_PRINTER_CONFIGURATION,
  PRINTER_CONNECTION_TYPES,
  PRINTER_COPY_OPTIONS,
  PRINTER_PAPER_SIZES,
  PRINTER_STATUSES,
} from './printerConstants.js'
import { createBrowserPrinterStorage } from './printerStorage.js'

const clone = (value) => JSON.parse(JSON.stringify(value))
const now = () => new Date().toISOString()

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `printer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} wajib diisi.`)
  }
  return value.trim()
}

function validatePaperSize(value) {
  const normalized = String(value)
  if (!PRINTER_PAPER_SIZES.includes(normalized)) {
    throw new Error('Ukuran kertas harus 58 mm atau 80 mm.')
  }
  return normalized
}

function validateCopies(value) {
  const normalized = Number(value)
  if (!PRINTER_COPY_OPTIONS.includes(normalized)) {
    throw new Error('Jumlah salinan harus 1, 2, atau 3.')
  }
  return normalized
}

function validatePrinter(input, existing = null) {
  const connectionType = String(input.connectionType || existing?.connectionType || '').toLowerCase()
  if (!PRINTER_CONNECTION_TYPES.includes(connectionType)) {
    throw new Error('Jenis koneksi harus Bluetooth, Wi-Fi, atau USB.')
  }

  const printer = {
    id: existing?.id || input.id || createId(),
    name: requireText(input.name ?? existing?.name, 'Nama printer'),
    connectionType,
    deviceIdentifier: String(input.deviceIdentifier ?? existing?.deviceIdentifier ?? '').trim() || null,
    deviceName: String(input.deviceName ?? existing?.deviceName ?? '').trim() || null,
    ipAddress: String(input.ipAddress ?? existing?.ipAddress ?? '').trim() || null,
    port: input.port ?? existing?.port ?? null,
    paperSize: validatePaperSize(input.paperSize ?? existing?.paperSize ?? '58'),
    createdAt: existing?.createdAt || input.createdAt || now(),
    lastUsedAt: input.lastUsedAt ?? existing?.lastUsedAt ?? null,
    lastConnectedAt: input.lastConnectedAt ?? existing?.lastConnectedAt ?? null,
  }

  if (connectionType === 'wifi') {
    printer.ipAddress = requireText(printer.ipAddress, 'Alamat IP printer Wi-Fi')
    const port = Number(printer.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('Port Wi-Fi harus berupa angka antara 1 sampai 65535.')
    }
    printer.port = port
  } else {
    printer.deviceIdentifier = requireText(printer.deviceIdentifier, 'Identitas perangkat printer')
  }

  return printer
}

function validateConfiguration(config) {
  const ids = new Set()
  for (const printer of config.printers) {
    if (!printer?.id || ids.has(printer.id)) {
      throw new Error('ID printer kosong atau duplikat.')
    }
    ids.add(printer.id)
  }

  if (config.primaryPrinterId && !ids.has(config.primaryPrinterId)) {
    throw new Error('Printer utama menunjuk ke perangkat yang tidak tersimpan.')
  }
  if (config.backupPrinterId && !ids.has(config.backupPrinterId)) {
    throw new Error('Printer cadangan menunjuk ke perangkat yang tidak tersimpan.')
  }
  if (config.primaryPrinterId && config.primaryPrinterId === config.backupPrinterId) {
    throw new Error('Printer utama dan cadangan tidak boleh perangkat yang sama.')
  }
  validatePaperSize(config.defaultPaperSize)
  validateCopies(config.defaultCopies)
  return config
}

/**
 * Central, device-local configuration manager.
 * Physical Bluetooth/USB identifiers intentionally stay on the device that
 * owns the connection; they must not be treated as remotely shareable IDs.
 */
export class PrinterManager {
  constructor({ storage = createBrowserPrinterStorage(), initialConfig = null } = {}) {
    this.storage = storage
    this.listeners = new Set()
    this.runtimeStatuses = new Map()
    this.warning = null

    if (initialConfig) {
      this.config = validateConfiguration(clone(initialConfig))
    } else {
      const loaded = this.storage.load()
      this.config = validateConfiguration({
        ...clone(DEFAULT_PRINTER_CONFIGURATION),
        ...clone(loaded.config),
        printers: Array.isArray(loaded.config?.printers) ? loaded.config.printers : [],
      })
      this.warning = loaded.warning || null
    }

    // A saved printer is never assumed connected after an app/device restart.
    for (const printer of this.config.printers) {
      this.runtimeStatuses.set(printer.id, 'DISCONNECTED')
    }
  }

  getSnapshot() {
    const config = clone(this.config)
    return {
      ...config,
      printers: config.printers.map((printer) => ({
        ...printer,
        status: this.runtimeStatuses.get(printer.id) || 'DISCONNECTED',
        role: printer.id === config.primaryPrinterId
          ? 'PRIMARY'
          : printer.id === config.backupPrinterId
            ? 'BACKUP'
            : null,
      })),
      warning: this.warning,
    }
  }

  getPrinter(printerId) {
    const printer = this.config.printers.find((item) => item.id === printerId)
    if (!printer) return null
    return {
      ...clone(printer),
      status: this.runtimeStatuses.get(printerId) || 'DISCONNECTED',
    }
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new Error('Listener harus berupa fungsi.')
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  _emit() {
    const snapshot = this.getSnapshot()
    for (const listener of this.listeners) listener(snapshot)
  }

  _commit(nextConfig) {
    const next = validateConfiguration({
      ...clone(nextConfig),
      schemaVersion: this.config.schemaVersion,
      updatedAt: now(),
    })
    // Persist first. If storage throws, this.config remains unchanged.
    this.storage.save(next)
    this.config = next
    this.warning = null
    this._emit()
    return this.getSnapshot()
  }

  addPrinter(input) {
    const printer = validatePrinter(input)
    const duplicate = this.config.printers.some((item) =>
      item.connectionType === printer.connectionType && (
        (printer.deviceIdentifier && item.deviceIdentifier === printer.deviceIdentifier) ||
        (printer.connectionType === 'wifi' && item.ipAddress === printer.ipAddress && item.port === printer.port)
      ),
    )
    if (duplicate) throw new Error('Perangkat printer tersebut sudah tersimpan.')

    this._commit({ ...this.config, printers: [...this.config.printers, printer] })
    this.runtimeStatuses.set(printer.id, 'DISCONNECTED')
    this._emit()
    return this.getPrinter(printer.id)
  }

  updatePrinter(printerId, changes) {
    const existing = this.config.printers.find((item) => item.id === printerId)
    if (!existing) throw new Error('Printer tidak ditemukan.')
    const updated = validatePrinter({ ...existing, ...changes, id: printerId }, existing)
    const duplicate = this.config.printers.some((item) => item.id !== printerId &&
      item.connectionType === updated.connectionType && (
        (updated.deviceIdentifier && item.deviceIdentifier === updated.deviceIdentifier) ||
        (updated.connectionType === 'wifi' && item.ipAddress === updated.ipAddress && item.port === updated.port)
      ),
    )
    if (duplicate) throw new Error('Identitas perangkat tersebut sudah digunakan printer lain.')

    this._commit({
      ...this.config,
      printers: this.config.printers.map((item) => item.id === printerId ? updated : item),
    })
    return this.getPrinter(printerId)
  }

  setPrimaryPrinter(printerId) {
    if (printerId !== null && !this.config.printers.some((item) => item.id === printerId)) {
      throw new Error('Pilih printer yang sudah tersimpan.')
    }
    if (printerId && printerId === this.config.backupPrinterId) {
      throw new Error('Printer ini sedang ditetapkan sebagai cadangan. Ubah atau kosongkan printer cadangan terlebih dahulu.')
    }
    return this._commit({ ...this.config, primaryPrinterId: printerId })
  }

  setBackupPrinter(printerId) {
    if (printerId !== null && !this.config.printers.some((item) => item.id === printerId)) {
      throw new Error('Pilih printer yang sudah tersimpan.')
    }
    if (printerId && printerId === this.config.primaryPrinterId) {
      throw new Error('Printer utama tidak boleh sekaligus menjadi printer cadangan.')
    }
    return this._commit({ ...this.config, backupPrinterId: printerId })
  }

  setDefaults({ defaultPaperSize = this.config.defaultPaperSize, defaultCopies = this.config.defaultCopies } = {}) {
    return this._commit({
      ...this.config,
      defaultPaperSize: validatePaperSize(defaultPaperSize),
      defaultCopies: validateCopies(defaultCopies),
    })
  }

  deletePrinter(printerId, { replacementPrimaryId = undefined } = {}) {
    const existing = this.config.printers.find((item) => item.id === printerId)
    if (!existing) throw new Error('Printer tidak ditemukan.')

    let primaryPrinterId = this.config.primaryPrinterId
    let backupPrinterId = this.config.backupPrinterId

    if (primaryPrinterId === printerId) {
      const remaining = this.config.printers.filter((item) => item.id !== printerId)
      if (remaining.length > 0) {
        if (replacementPrimaryId === undefined || replacementPrimaryId === null) {
          throw new Error('Pilih printer utama pengganti sebelum menghapus printer utama.')
        }
        if (replacementPrimaryId === printerId || !remaining.some((item) => item.id === replacementPrimaryId)) {
          throw new Error('Printer utama pengganti tidak valid.')
        }
        if (replacementPrimaryId === backupPrinterId) {
          throw new Error('Printer cadangan tidak dapat langsung menjadi printer utama sebelum penetapan cadangan diubah.')
        }
        primaryPrinterId = replacementPrimaryId
      } else {
        primaryPrinterId = null
      }
    }

    if (backupPrinterId === printerId) backupPrinterId = null

    this._commit({
      ...this.config,
      printers: this.config.printers.filter((item) => item.id !== printerId),
      primaryPrinterId,
      backupPrinterId,
    })
    this.runtimeStatuses.delete(printerId)
    this._emit()
    return this.getSnapshot()
  }

  updateStatus(printerId, status) {
    if (!this.config.printers.some((item) => item.id === printerId)) {
      throw new Error('Printer tidak ditemukan.')
    }
    if (!PRINTER_STATUSES.includes(status)) throw new Error('Status printer tidak dikenal.')
    this.runtimeStatuses.set(printerId, status)
    if (status === 'CONNECTED' || status === 'READY') {
      const printer = this.config.printers.find((item) => item.id === printerId)
      const updatedPrinter = { ...printer, lastConnectedAt: now() }
      // Status/last-connected metadata is best-effort; never block runtime status.
      try {
        this._commit({ ...this.config, printers: this.config.printers.map((item) => item.id === printerId ? updatedPrinter : item) })
      } catch {
        this._emit()
      }
    } else {
      this._emit()
    }
  }

  markUsed(printerId) {
    const existing = this.config.printers.find((item) => item.id === printerId)
    if (!existing) throw new Error('Printer tidak ditemukan.')
    const updated = { ...existing, lastUsedAt: now() }
    this._commit({
      ...this.config,
      printers: this.config.printers.map((item) => item.id === printerId ? updated : item),
    })
  }

  getSelectedPrinterId() {
    return this.config.primaryPrinterId
  }

  getBackupPrinterId() {
    return this.config.backupPrinterId
  }
}

export function createPrinterManager(options) {
  return new PrinterManager(options)
}
