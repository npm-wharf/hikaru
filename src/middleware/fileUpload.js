const multi = require('multiparty')
const fs = require('fs')
const path = require('path')
const log = require('bole')('form-parser')

const TAR_DIR = path.resolve(path.join(process.cwd(), 'tar'))

if (!fs.existsSync(TAR_DIR)) {
  fs.mkdirSync(TAR_DIR)
}

module.exports = function file () {
  return [
    function upload (env, next) {
      const form = new multi.Form({
        autoFiles: true,
        autoFields: true,
        uploadDir: TAR_DIR
      })

      form.on('error', e => {
        log.error(`error parsing upload:\n\t${e.stack}`)
      })

      env.fields = {}
      form.on('file', (file, val) => {
        env.file = file
        fs.chmodSync(val.path, 436)
        const ext = path.extname(file)
        const name = file.replace(ext, '')
        const newPath = path.join(TAR_DIR, name)
        const tar = path.basename(val.path)
        const newFile = path.join(newPath, tar)
        fs.mkdirSync(newPath)
        fs.renameSync(val.path, newFile)
        env.filePath = newFile
      })

      form.on('close', () => {
        next()
      })

      form.parse(env.request, (no, fields, files) => {
        env.fields = fields
      })
    }
  ]
}
