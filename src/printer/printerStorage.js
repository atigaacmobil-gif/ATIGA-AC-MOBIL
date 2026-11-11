import {
  DEFAULT_PRINTER_CONFIGURATION,
  PRINTER_CONFIG_SCHEMA_VERSION,
  PRINTER_CONFIG_STORAGE_KEY,
} from './printerConstants.js'

export class PrinterStorageError extends Error {
  constructor(message, cause) {
    super(message)
    this.name = 'PrinterStorageError'
    this.cause = cause
  }
}

export function createBrowserPrinterStorage(storage = globalThis.localStorage) {
  return {
    load() {
      if (!storage) {
        return {
          config: structuredClone(DEFAULT_PRINTER_CONFIGURATION),
          warning: 'Penyimpanan lokal tidak tersedia pada lingkungan ini.',
        }
      }

      let raw
      try {
        raw = storage.getItem(PRINTER_CONFIG_STORAGE_KEY)
      } catch (error) {
        throw new PrinterStorageError('Gagal membaca konfigurasi printer.', error)
      }

      if (!raw) {
        return {
          config: structuredClone(DEFAULT_PRINTER_CONFIGURATION),
          warning: null,
        }
      }

      try {
        const parsed = JSON.parse(raw)
        if (!parsed || parsed.schemaVersion !== PRINTER_CONFIG_SCHEMA_VERSION) {
          return {
            config: structuredClone(DEFAULT_PRINTER_CONFIGURATION),
            warning: 'Versi konfigurasi printer belum dikenali. Data lama tidak ditimpa otomatis.',
          }
        }
        return { config: parsed, warning: null }
      } catch (error) {
        if (error instanceof SyntaxError) {
          return {
            config: structuredClone(DEFAULT_PRINTER_CONFIGURATION),
            warning: 'Konfigurasi printer lokal tidak dapat dibaca. Data lama tidak ditimpa otomatis.',
          }
        }
        throw error
      }
    },

    save(config) {
      if (!storage) {
        throw new PrinterStorageError('Penyimpanan lokal tidak tersedia.')
      }
      try {
        // localStorage.setItem replaces one value atomically. The caller only
        // updates its in-memory snapshot after this write succeeds.
        storage.setItem(PRINTER_CONFIG_STORAGE_KEY, JSON.stringify(config))
      } catch (error) {
        throw new PrinterStorageError('Gagal menyimpan konfigurasi printer. Perubahan dibatalkan.', error)
      }
    },

    remove() {
      if (!storage) return
      try {
        storage.removeItem(PRINTER_CONFIG_STORAGE_KEY)
      } catch (error) {
        throw new PrinterStorageError('Gagal menghapus konfigurasi printer.', error)
      }
    },
  }
}
