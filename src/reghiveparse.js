'use strict'

// Registry hive parsing

const jBinary = require('jbinary')
const offset_to_first_hbin = 0x1000

function hiveTypeSet(codepage = 'cp1252') {
  return {
    'jBinary.all': 'File',
    'jBinary.littleEndian': true,

    // File header

    File: {
      _magic: ['const', ['string', 4], 'regf', true],
      seq1: 'uint32',
      seq2: 'uint32',
      timestamp: 'uint64',
      major_version: 'uint32',
      minor_version: 'uint32',
      type: ['enum', 'uint32', [
        'registry',
        'log',
      ]],
      _unk1: ['const', 'uint32', 1, true],
      offset_to_root_key: 'uint32',
      total_hbin_length: 'uint32',
      _unk2: ['const', 'uint32', 1, true],
      embedded_filename: ['string', 64, 'utf-16'],
      _padding: ['skip', function() { return 508 - this.binary.tell() }],
      checksum: 'uint32',
      _realChecksum: function() {
        const dwords = this.binary.read(['array', 'uint32', 127], 0)
        let checksum = 0
        for(let dword of dwords) checksum ^= dword
        return checksum
      },
      hasValidChecksum: jBinary.Type({
        read: context => context.checksum === context._realChecksum
      }),
      root_key: function(context) {
        return this.binary.read('Key', context.offset_to_root_key + offset_to_first_hbin)
      },
    },

    // Utility functions

    Length: jBinary.Template({
      read: context => Math.abs(context._length)
    }),
    Allocated: jBinary.Template({
      read: context => context._length < 0 ? true : false
    }),
    ClassName: jBinary.Template({
      read: function(context) {
        if (context.offset_to_class_name != 0xffffffff) {
          return this.binary.read(['string', context.class_name_length, 'utf-16'], offset_to_class_name + offset_to_first_hbin + 4)
        }
      },
    }),

    // Like const, but with a list of accepted values

    AnyOf: jBinary.Template({
      params: ['baseType', 'values', 'strict'],
      read: function () {
        var value = this.baseRead();
        if (this.strict && !this.values.includes(value)) {
          if (typeof this.strict === 'function') {
            return this.strict(values);
          } else {
            throw new TypeError('Unexpected value (' + value + ' !== [' + this.values.join(',') + ']).');
          }
        }
        return value;
      },
    }),

    // Registry key

    Key: {
      _length: 'int32',
      length: 'Length',
      allocated: 'Allocated',
      _magic: ['const', ['string', 2], 'nk'],
      flags: 'uint16',
      timestamp: 'uint64',
      _unk1: ['skip', 4],
      offset_to_parent: 'uint32',
      number_of_subkeys: 'uint32',
      _unk2: ['skip', 4],
      offset_to_subkey_list: 'uint32',
      _unk3: ['skip', 4],
      number_of_values: 'uint32',
      offset_to_value_list: 'uint32',
      offset_to_security: 'uint32',
      offset_to_class_name: 'uint32',
      max_subkey_name_length: 'uint32',
      max_class_name_length: 'uint32',
      max_value_name_length: 'uint32',
      max_value_data_length: 'uint32',
      _unk4: ['skip', 4],
      key_name_length: 'uint16',
      class_name_length: 'uint16',
      name: ['if', context => context.flags & 0x20,
        ['string', context => context.key_name_length, codepage],
        ['string', context => context.key_name_length, 'utf-16'],
      ],
      class_name: 'ClassName',
    },

    // List of key pointers

    KeyList: {
      _length: 'int32',
      length: 'Length',
      allocated: 'Allocated',
      _magic: ['AnyOf', ['string', 2], ['li', 'lf', 'lh', 'ri'], true],
      number_of_entries: 'uint16',
      entries: 'KeyListEntries',
    },
    KeyListEntries: jBinary.Template({
      read: function(context) {
        const a = []
        for(let n = 0; n < context.number_of_entries; n++) a.push(this.binary.read(context._magic.toUpperCase()))
        return a
      },
    }),
    LH: {
      offset_to_key: 'uint32',
      hash_of_key_name: 'uint32',
    },
    RI: {
      offset_to_subkey_list: 'uint32',
    },
    LF: {
      offset_to_key: 'uint32',
      first_four_characters: ['string', 4],
    },
    LI: {
      offset_to_key: 'uint32',
    },

    // List of value pointers

    ValueOffsetsList: {
      _length: 'int32',
      length: 'Length',
      allocated: 'Allocated',
      items: ['array', 'uint32', context => (context.length - 8) / 4],
    },

    // Single value

    Value: {
      _length: 'int32',
      length: 'Length',
      allocated: 'Allocated',
      _magic: ['const', ['string', 2], 'vk'],
      name_length: 'uint16',
      data_length: 'uint32',
      offset_to_inline_data: function() { return this.binary.tell() },
      offset_to_data: 'uint32',
      value_type: ['enum', 'uint32', [
        'REG_NONE',
        'REG_SZ',
        'REG_EXPAND_SZ',
        'REG_BINARY',
        'REG_DWORD',
        'REG_DWORD_BIG_ENDIAN',
        'REG_LINK',
        'REG_MULTI_SZ',
        'REG_RESOURCE_LIST',
        'REG_FULL_RESOURCE_DESCRIPTOR',
        'REG_RESOURCE_REQUIREMENTS_LIST',
        'REG_QWORD',
      ]],
      flags: 'uint16',
      _unk1: ['skip', 2],
      name: ['if', context => context.flags & 1,
        ['string', context => context.name_length, codepage],
        ['string', context => context.name_length, 'utf-16'],
      ],
      data: ['if', context => context.data_length & 0x80000000, 'InlineValueData', 'ValueData'],
    },

    // Value data
    // Currently always returned as uint8 array
    // TODO: use value type to parse it

    InlineValueData: jBinary.Template({
      read: function(context) {
        return this.binary.read(['array', 'uint8', context.data_length & 0x7fffffff], context.offset_to_inline_data)
      },
    }),
    ValueData: jBinary.Template({
      read: function(context) {
        this.binary.seek(context.offset_to_data + offset_to_first_hbin)
        const hdr = this.binary.read('ValueDataHdr')
        if (context.data_length > hdr.length) {

          // Code to read large values
          // TODO: test if this works

          const blhdr = this.binary.read('ValueDataBlockListHdr')
          this.binary.seek(blhdr.offset_to_data_block_list + offset_to_first_hbin + 4)
          const offsets = this.binary.read(['array', 'uint32', blhdr.num_data_blocks])
          let data = []
          for(let offset of offsets) {
            this.binary.seek(offset + offset_to_first_hbin)
            const bhdr = this.binary.read('ValueDataBlockHdr')
            data = data.concat(this.binary.read(['array', 'uint8', bhdr.length - 8]))
          }
          return data
        } else {
          return this.binary.read(['array', 'uint8', context.data_length & 0x7fffffff])
        }
      },
    }),
    ValueDataHdr: {
      _length: 'int32',
      length: 'Length',
      allocated: 'Allocated',
    },
    ValueDataBlockListHdr: {
      _magic: ['const', ['string', 2], 'db'],
      num_data_blocks: 'uint16',
      offset_to_data_block_list: 'uint32',
    },
    ValueDataBlockHdr: {
      _length: 'int32',
      length: 'Length',
      allocated: 'Allocated',
    },
  }
}

module.exports = function parseHive(buf) {
  const typeSet = hiveTypeSet()
  const hiveParser = new jBinary(buf, typeSet)
  const hive = hiveParser.readAll()

  // Functions for reading values and subkeys
  // TODO: can we move them inside typeSet but somehow execute on-access,
  //       so it doesn't parse the whole registry at once?
  // TODO: add a function to get key / value by name instead of enumerating them all

  const values = (key) => {
    if (key.number_of_values === 0) return
    const list = []
    const offsets = hiveParser.read('ValueOffsetsList', key.offset_to_value_list + offset_to_first_hbin)
    for(let offset of offsets.items) {
      list.push(hiveParser.read('Value', offset + offset_to_first_hbin))
    }
    return list
  }

  const subkeys = (key, list = []) => {
    const keylist = hiveParser.read('KeyList', key.offset_to_subkey_list + offset_to_first_hbin)
    for(let el of keylist.entries) {
      // Found another list, enumerate recursively
      if ('offset_to_subkey_list' in el) subkeys(el, list)
      // Found key, read it
      else if ('offset_to_key' in el) {
        const key = hiveParser.read('Key', el.offset_to_key + offset_to_first_hbin)

        key.subkeys = () => subkeys(key)
        key.values = () => values(key)

        list.push(key)
      } else {
        // Found ???
        // Shouldn't happen, since we parse either as Key or KeyList,
        // so one of the above properties must exist
        throw new Error("Unreachable!")
      }
    }
    return list;
  }

  hive.root_key.subkeys = () => subkeys(hive.root_key)
  hive.root_key.values = () => values(hive.root_key)

  return hive
}

