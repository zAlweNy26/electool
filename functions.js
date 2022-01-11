import fs from "fs"
import path from "path"
import { JSDOM } from "jsdom"

const searchInDir = (startPath, filter, cb) => {
    if (!fs.existsSync(startPath)) return
    let files = fs.readdirSync(startPath)
    for (let i = 0; i < files.length; i++) {
        let filename = path.join(startPath, files[i])
        let stat = fs.lstatSync(filename)
        if (stat.isDirectory()) searchInDir(filename, filter, cb)
        else if (filter.test(filename)) cb(filename)
    }
}

export const formatBytes = (bytes, dm = 2) => {
    if (bytes === 0) return '0 Bytes'
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(Math.abs(dm))) + ' ' + sizes[i]
}

export const injectCSS = (folder, files) => {
    try {
        searchInDir(folder, /\.html$/, fn => {
            if (fn == null || fn == undefined) throw new Error("no file")
            let data = fs.readFileSync(fn, "utf-8")
            let dom = new JSDOM(`${data}`).window.document
            let head = dom.querySelector("head")
            if (!head) return console.log("\x1b[31mUnable to locate HEAD tag in the HTML document !\x1b[0m")
            files.forEach(e => {
                if (!fs.existsSync(path.resolve(e))) console.log(`\x1b[33mThe file ${e} was not found so it was skipped.\x1b[0m`)
                else {
                    fs.copyFileSync(path.resolve(e), path.join(path.dirname(fn), path.basename(e)), fs.constants.COPYFILE_FICLONE)
                    head.insertAdjacentHTML("beforeend", `<link rel="stylesheet" href="${path.basename(e)}">`)
                }
            })
            fs.writeFileSync(fn, dom.documentElement.outerHTML)
        })
    } catch (err) {
        console.log("\x1b[31mAn error has occurred while injecting css files !\x1b[0m")
    }
}

export const injectJS = (folder, files) => {
    try {
        searchInDir(folder, /\.html$/, fn => {
            if (fn == null || fn == undefined) throw new Error("no file")
            let data = fs.readFileSync(fn, "utf-8")
            let dom = new JSDOM(`${data}`).window.document
            let body = dom.querySelector("body")
            if (!body) return console.log("\x1b[31mUnable to locate BODY tag in the HTML document !\x1b[0m")
            files.forEach(e => {
                if (!fs.existsSync(path.resolve(e))) console.log(`\x1b[33mThe file ${e} was not found so it was skipped.\x1b[0m`)
                else {
                    fs.copyFileSync(path.resolve(e), path.join(path.dirname(fn), path.basename(e)), fs.constants.COPYFILE_FICLONE)
                    body.insertAdjacentHTML("beforeend", `<script src="${path.basename(e)}"></script>`)
                }
            })
            fs.writeFileSync(fn, dom.documentElement.outerHTML)
        })
    } catch (err) {
        console.log("\x1b[31mAn error has occurred while injecting css files !\x1b[0m")
    }
}