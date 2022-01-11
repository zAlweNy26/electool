import fs from "fs"
import path from "path"

export const formatBytes = (bytes, dm = 2) => {
    if (bytes === 0) return '0 Bytes'
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(Math.abs(dm))) + ' ' + sizes[i]
}

export const searchInDir = (startPath, filter, cb) => {
    if (!fs.existsSync(startPath)) return
    let files = fs.readdirSync(startPath)
    for (let i = 0; i < files.length; i++) {
        let filename = path.join(startPath, files[i])
        let stat = fs.lstatSync(filename)
        if (stat.isDirectory()) searchInDir(filename, filter, cb)
        else if (filter.test(filename)) cb(filename)
    }
}