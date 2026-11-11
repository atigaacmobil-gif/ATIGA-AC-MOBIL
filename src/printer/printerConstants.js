export const PRINTER_CONFIG_STORAGE_KEY = 'atiga_ac_mobil_printer_config_v1'
export const PRINTER_CONFIG_SCHEMA_VERSION = 1

export const PRINTER_CONNECTION_TYPES = Object.freeze([
  'bluetooth',
  'wifi',
  'usb',
])

export const PRINTER_PAPER_SIZES = Object.freeze(['58', '80'])
export const PRINTER_COPY_OPTIONS = Object.freeze([1, 2, 3])

export const PRINTER_STATUSES = Object.freeze([
  'DISCONNECTED',
  'CONNECTING',
  'NOT_FOUND',
  'CONNECTION_FAILED',
  'CONNECTED',
  'READY',
  'PRINTING',
  'PRINT_FAILED',
])

export const DEFAULT_PRINTER_CONFIGURATION = Object.freeze({
  schemaVersion: PRINTER_CONFIG_SCHEMA_VERSION,
  printers: [],
  primaryPrinterId: null,
  backupPrinterId: null,
  defaultPaperSize: '58',
  defaultCopies: 1,
  updatedAt: null,
})
