import { useState } from 'react'
import { toCssUrl } from '../../lib/css'
import { readLocal, removeLocal, storeLocal } from '../../lib/storage'

const MAX_BACKGROUND_UPLOAD_BYTES = 2 * 1024 * 1024
const MONKEY_BACKGROUND_URL = 'https://i.imgur.com/Ub9yNZH.png'

export type BackgroundKind = 'none' | 'kees' | 'url' | 'upload'

type Notify = {
  showError: (message: string) => void
  showSuccess: (message: string) => void
}

/**
 * The app background: plain, the Kees modus preset, an image link, or an uploaded photo. Only one
 * is active at a time. Everything is stored on this device (localStorage), never sent to the server.
 * The three flags keep their original storage keys so existing choices carry over.
 */
export function useBackgroundSettings({ showError, showSuccess }: Notify) {
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(() => readLocal('backgroundImageUrl'))
  const [uploadedBackgroundData, setUploadedBackgroundData] = useState(() => readLocal('uploadedBackgroundData'))
  const [kind, setKind] = useState<BackgroundKind>(() => {
    if (readLocal('useUploadedBackground') === 'true' && readLocal('uploadedBackgroundData')) return 'upload'
    if (readLocal('useMonkeyBackground') === 'true') return 'kees'
    if (readLocal('useCustomBackground') === 'true') return 'url'
    return 'none'
  })

  function selectBackground(next: BackgroundKind) {
    setKind(next)
    storeLocal('useUploadedBackground', next === 'upload' ? 'true' : 'false')
    storeLocal('useMonkeyBackground', next === 'kees' ? 'true' : 'false')
    storeLocal('useCustomBackground', next === 'url' ? 'true' : 'false')
  }

  function changeBackgroundImageUrl(url: string) {
    setBackgroundImageUrl(url)
    storeLocal('backgroundImageUrl', url)
  }

  function uploadBackgroundImage(file: File) {
    if (!file.type.startsWith('image/')) {
      showError('Please select an image file.')
      return
    }
    if (file.size > MAX_BACKGROUND_UPLOAD_BYTES) {
      showError('Image is too large. Please choose one under 2 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      if (!storeLocal('uploadedBackgroundData', base64)) {
        showError('Could not store the image on this device (storage full or unavailable).')
        return
      }
      setUploadedBackgroundData(base64)
      selectBackground('upload')
      showSuccess('Background updated.')
    }
    reader.onerror = () => showError('Failed to read the image file.')
    reader.readAsDataURL(file)
  }

  function clearUploadedBackground() {
    setUploadedBackgroundData('')
    removeLocal('uploadedBackgroundData')
    selectBackground('none')
    showSuccess('Photo removed.')
  }

  // CSS value for the background layer.
  const backgroundImage =
    kind === 'upload' && uploadedBackgroundData
      ? toCssUrl(uploadedBackgroundData)
      : kind === 'kees'
        ? `url('${MONKEY_BACKGROUND_URL}')`
        : kind === 'url' && backgroundImageUrl
          ? toCssUrl(backgroundImageUrl)
          : 'none'

  return {
    kind,
    backgroundImage,
    backgroundImageUrl,
    hasUploadedImage: Boolean(uploadedBackgroundData),
    selectBackground,
    changeBackgroundImageUrl,
    uploadBackgroundImage,
    clearUploadedBackground,
  }
}
