export const pendingToastEventName = 'app:pending-toast'
export const toastQueryParam = 'toast'
export const successToastValue = 'done'

export function appendToastParam(path: string, toast: string = successToastValue) {
  const hashIndex = path.indexOf('#')
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : ''
  const pathWithoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path
  const queryIndex = pathWithoutHash.indexOf('?')
  const pathname =
    queryIndex >= 0 ? pathWithoutHash.slice(0, queryIndex) : pathWithoutHash
  const search = queryIndex >= 0 ? pathWithoutHash.slice(queryIndex + 1) : ''
  const params = new URLSearchParams(search)

  params.set(toastQueryParam, toast)

  const nextSearch = params.toString()

  return `${pathname}${nextSearch ? `?${nextSearch}` : ''}${hash}`
}

export function dispatchPendingToast(message: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent(pendingToastEventName, {
      detail: { message },
    })
  )
}

export function getToastMessage(value: string | null) {
  if (value === successToastValue) {
    return 'Done'
  }

  return value || ''
}
