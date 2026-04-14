const DEFAULT_REPOSITORY_CONFIG = {
  provider: 'github',
  owner: '',
  repo: '',
  branch: 'main',
  wallpaperRoot: 'wallpaper',
  manifestPath: 'config/upload-workspace.manifest.json'
}

const DEFAULT_UPLOAD_CONFIG = {
  maxFileSizeMB: 25,
  batchWarningThreshold: 50,
  uploadDelayMs: 500,
  metadataPendingDir: 'metadata-pending',
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp']
}

export const DEFAULT_APP_CONFIG = {
  repository: DEFAULT_REPOSITORY_CONFIG,
  upload: DEFAULT_UPLOAD_CONFIG
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function mergeConfig(base, overrides) {
  if (!isPlainObject(overrides)) {
    return Array.isArray(base) ? [...base] : base
  }

  const result = Array.isArray(base) ? [...base] : { ...base }

  for (const [key, value] of Object.entries(overrides)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = mergeConfig(result[key], value)
    } else {
      result[key] = value
    }
  }

  return result
}

export function resolveAppConfig(overrides = {}) {
  return mergeConfig(DEFAULT_APP_CONFIG, overrides)
}
