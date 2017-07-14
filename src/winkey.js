'use strict'

// Find Windows product key in the registry
// TODO: make an API to get value by path

module.exports = function findWindowsKey(registry_key) {
  const path = ['Microsoft', 'Windows NT', 'CurrentVersion']
  let key
  for(let key_name of path) {
    key_name = key_name.toLowerCase()
    let found = 0
    for(key of registry_key.subkeys()) {
      if (key.name.toLowerCase() === key_name) {
        found = 1
        break
      }
    }
    if (found === 0) return
    registry_key = key
  }
  const values = key.values()
  for(let value of values) {
    if (value.name.toLowerCase() === 'digitalproductid') {
      return decodeProductId(value.data.slice(52, 67))
    }
  }
}

// Convert Windows product key to human readable form
// CAUTION: input array is modified by this function!

function decodeProductId(data) {
  const digits = 'BCDFGHJKMPQRTVWXY2346789'
  let decoded = ''
  for(let i = 24; i >= 0; i--) {
    let a = 0
    for(let byte_i = 14; byte_i >= 0; byte_i--) {
      a <<= 8
      a ^= data[byte_i]
      data[byte_i] = a / 24 | 0
      a %= 24
    }
    decoded = digits[a] + decoded
    if (i % 5 === 0 && i !== 0) decoded = '-' + decoded
  }
  return decoded
}

