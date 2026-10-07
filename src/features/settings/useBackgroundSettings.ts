import { useState } from 'react'
import { toCssUrl } from '../../lib/css'
import { readLocal, removeLocal, storeLocal } from '../../lib/storage'

const MAX_BACKGROUND_UPLOAD_BYTES = 2 * 1024 * 1024
const MONKEY_BACKGROUND_URL = 'https://i.imgur.com/Ub9yNZH.png'

type Notify = {
  showError: (message: string) => void
  showSuccess: (message: string) => void
}

/**
 * The app background: a preset, a custom image URL, or an uploaded image. Only one is active at a
 * time. Everything is stored on this device (localStorage), never sent to the server.
 */
export function useBackgroundSettings({ showError, showSuccess }: Notify) {
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(() => readLocal('backgroundImageUrl'))
  const [useCustomBackground, setUseCustomBackground] = useState(
    () => readLocal('useCustomBackground') === 'true',
  )
  const [useMonkeyBackground, setUseMonkeyBackground] = useState(
    () => readLocal('useMonkeyBackground') === 'true',
  )
  const [uploadedBackgroundData, setUploadedBackgroundData] = useState(() =>
    readLocal('uploadedBackgroundData'),
  )
  const [useUploadedBackground, setUseUploadedBackground] = useState(
    () => readLocal('useUploadedBackground') === 'true',
  )

  function handleBackgroundImageUrlChange(url: string) {
    setBackgroundImageUrl(url)
    storeLocal('backgroundImageUrl', url)
  }

  function handleUseCustomBackgroundChange(enabled: boolean) {
    setUseCustomBackground(enabled)
    storeLocal('useCustomBackground', enabled ? 'true' : 'false')
    // Disable other backgrounds if enabling custom
    if (enabled) {
      if (useMonkeyBackground) {
        setUseMonkeyBackground(false)
        storeLocal('useMonkeyBackground', 'false')
      }
      if (useUploadedBackground) {
        setUseUploadedBackground(false)
        storeLocal('useUploadedBackground', 'false')
      }
    }
  }

  function handleUseMonkeyBackgroundChange(enabled: boolean) {
    setUseMonkeyBackground(enabled)
    storeLocal('useMonkeyBackground', enabled ? 'true' : 'false')
    // Disable other backgrounds if enabling monkey
    if (enabled) {
      if (useCustomBackground) {
        setUseCustomBackground(false)
        storeLocal('useCustomBackground', 'false')
      }
      if (useUploadedBackground) {
        setUseUploadedBackground(false)
        storeLocal('useUploadedBackground', 'false')
      }
    }
  }

  function handleUploadBackgroundImage(file: File) {
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
      setUseUploadedBackground(true)
      storeLocal('useUploadedBackground', 'true')
      // Disable other backgrounds
      setUseCustomBackground(false)
      storeLocal('useCustomBackground', 'false')
      setUseMonkeyBackground(false)
      storeLocal('useMonkeyBackground', 'false')
      showSuccess('Image uploaded successfully!')
    }
    reader.onerror = () => {
      showError('Failed to read the image file.')
    }
    reader.readAsDataURL(file)
  }

  function handleClearUploadedBackground() {
    setUploadedBackgroundData('')
    setUseUploadedBackground(false)
    removeLocal('uploadedBackgroundData')
    storeLocal('useUploadedBackground', 'false')
    showSuccess('Uploaded image removed.')
  }

  function handleUseUploadedBackgroundChange(enabled: boolean) {
    setUseUploadedBackground(enabled)
    storeLocal('useUploadedBackground', enabled ? 'true' : 'false')
    // Disable other backgrounds if enabling uploaded
    if (enabled) {
      if (useCustomBackground) {
        setUseCustomBackground(false)
        storeLocal('useCustomBackground', 'false')
      }
      if (useMonkeyBackground) {
        setUseMonkeyBackground(false)
        storeLocal('useMonkeyBackground', 'false')
      }
    }
  }

  // CSS value for the app shell's background-image.
  const backgroundImage =
    useUploadedBackground && uploadedBackgroundData
      ? toCssUrl(uploadedBackgroundData)
      : useMonkeyBackground
        ? `url('${MONKEY_BACKGROUND_URL}')`
        : useCustomBackground && backgroundImageUrl
          ? toCssUrl(backgroundImageUrl)
          : 'none'

  return {
    backgroundImage,
    backgroundImageUrl,
    useCustomBackground,
    useMonkeyBackground,
    uploadedBackgroundData,
    useUploadedBackground,
    handleBackgroundImageUrlChange,
    handleUseCustomBackgroundChange,
    handleUseMonkeyBackgroundChange,
    handleUploadBackgroundImage,
    handleClearUploadedBackground,
    handleUseUploadedBackgroundChange,
  }
}
