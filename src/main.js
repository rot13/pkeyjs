(function() {
  'use strict'

  const parseHive = require('./reghiveparse.js')
  const findWindowsKey = require('./winkey.js')

  // GUI

  function logAdd(text = '') {
    const div = document.createElement('div')
    document.getElementById('log').appendChild(div)
    div.textContent = text
    return div
  }

  function fileHandler(e) {
    e.preventDefault()
    e.target.classList.remove('drop')
    const files = e.target.files || e.dataTransfer.files
    for(let file of files) {
      const loading = logAdd("Loading file")
      const reader = new FileReader()
      reader.onload = e => {
        logAdd("Parsing file")
        let hive
        try {
          hive = parseHive(e.target.result)
        } catch(e) {
          logAdd("Error parsing file: "+e)
          return
        }

        // TODO: add more product keys

        logAdd("Searching for Windows key")
        try {
          const key = findWindowsKey(hive.root_key)
          if (key) {
            logAdd("Found Windows key: "+key)
          } else {
            logAdd("Key not found")
          }
        } catch(e) {
          logAdd("Error searching: "+e)
        }
      }
      reader.onerror = () => {
        logAdd("Error loading file")
      }
      reader.onprogress = e => {
        loading.innerText = "Loading file ("+e.loaded+"/"+e.total+")"
      }
      try {
        reader.readAsArrayBuffer(file)
      } catch(e) {
        logAdd("Error loading file: "+e)
      }
    }
  }

  const loadbtn = document.getElementById('load')
  loadbtn.addEventListener('dragenter', e => loadbtn.classList.add('drop'))
  loadbtn.addEventListener('dragleave', e => loadbtn.classList.remove('drop'))
  loadbtn.addEventListener('dragover', e => {
    e.dataTransfer.dropEffect = 'copy'
    e.preventDefault()
  })
  loadbtn.addEventListener('drop', fileHandler)
  document.getElementById('selector').addEventListener('change', fileHandler);
})()

