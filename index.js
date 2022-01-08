import fs from "fs"
import path from "path"
import asar from "asar"
import commander, { Command } from "commander"
import ElectronRemoteDebugger from "./debugger.js"
const pjson = JSON.parse(fs.readFileSync("package.json"))

const devToolsKeysScript = `document.addEventListener("keydown", function (e) {
    if (e.keyCode === 123) { // F12
        require("electron").remote.BrowserWindow.getFocusedWindow().webContents.toggleDevTools()
    } else if (e.keyCode === 116) { // F5
        location.reload()
        console.log("All scripts were removed because of reloading !")
    }
})`

function convertToInteger(value) {
    const parsedValue = parseInt(value, 10)
    if (isNaN(parsedValue) || parsedValue < 0) 
        throw new commander.InvalidArgumentError('The inserted value is not a valid number.')
    return parsedValue
}

function formatBytes(bytes, dm = 2) {
    if (bytes === 0) return '0 Bytes'
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(Math.abs(dm))) + ' ' + sizes[i]
}

const program = new Command()
    .usage('<app> [options]')
    .description("Injects various things into the specified electron app")
    .option('-p, --port <port>', 'launch with a specific port', convertToInteger)
    .option('-t, --timeout <seconds>', 'time to wait before stop trying to inject', convertToInteger)
    .option('-s, --scripts <folder>', 'add scripts to be injected into each window (render thread)')
    .option('-d, --devkeys', 'enable hotkeys F12 (toggle developer tools) and F5 (refresh)')
    .option('-b, --browser', 'launch devtools in default browser')
    .option('-u, --unpack <file>', 'unpack the .asar file to get the source code of the app')
    .option('-p, --pack <folder>', 'pack the inserted folder into .asar file')
    .version(`v${pjson.version} by zAlweNy26`, '-v, --version', 'output the current version of the program')
    .parse(process.argv)

const opts = program.opts()
var scripts = []

function checkArgs() {
    let app = fs.statSync(program.args[0])
    if (app == null || !app.isFile() || path.extname(program.args[0]) != ".exe") {
        console.log("\x1b[31mThe inserted file path was not found or is not valid !\x1b[0m")
        return false
    }
    if (opts.scripts != undefined) {
        let folder = fs.statSync(opts.scripts)
        if (folder == null || !folder.isDirectory()) {
            console.log("\x1b[31mThe inserted directory path was not found or is not valid !\x1b[0m")
            return false
        }
        fs.readdirSync(opts.scripts).forEach(file => {
            let fileSize = fs.statSync(path.join(opts.scripts, file))
            let data = fs.readFileSync(path.join(opts.scripts, file), "utf-8")
            scripts.push({ name: file, content: data, size: formatBytes(fileSize.size)})
        })
    }
    if (opts.unpack != undefined) {
        let packed = fs.statSync(opts.unpack)
        if (packed == null || !packed.isFile() || path.extname(opts.unpack) != ".asar")
            console.log("\x1b[31mThe inserted file path was not found or is not valid !\x1b[0m")
        else {
            asar.extractAll(opts.unpack, "./unpacked")
            console.log(`\x1b[32mThe .asar file was unpacked successfully !\x1b[0m`)
        }
        return false
    }
    if (opts.pack != undefined) {
        let unpacked = fs.statSync(opts.pack)
        if (unpacked == null || !unpacked.isDirectory())
            console.log("\x1b[31mThe inserted directory path was not found or is not valid !\x1b[0m")
        else {
            asar.createPackage(opts.pack, "./app.asar")
            .then(() => console.log(`\x1b[32mThe inserted folder was packed successfully !\x1b[0m`))
            .catch(err => console.log(`\x1b[31mAn error as occurred while packing the folder !\x1b[0m`))
        }
        return false
    }
    return true
}

async function startInject() {
    let timeout = opts.timeout == undefined ? 5 : opts.timeout
    let erd = new ElectronRemoteDebugger("localhost", opts.port)
    await erd.execute(program.args[0], timeout)
    let windowsVisited = []
    console.log(`\x1b[33mSearching for ${timeout} seconds...\x1b[0m`)
    let timer = setInterval(async () => {
        let ws = await erd.windows()
        if (--timeout == 0 || ws.every(cv => windowsVisited.includes(cv.id))) {
            if (opts.browser) erd.start(`http://${erd.host}:${erd.port}/`)
            clearInterval(timer)
        }
        let notws = ws.filter(x => !windowsVisited.includes(x.id) && x.title != "")
        notws.forEach(k => {
            try {
                if (opts.devkeys) {
                    console.log(`\x1b[32mInjecting hotkeys script into ${k.title} (${k.id})\x1b[0m`)
                    erd.eval(k.ws, devToolsKeysScript)
                }
                scripts.forEach(v => {
                    console.log(`\x1b[32mInjecting ${v.name} (${v.size}) into "${k.title}" (${k.id})\x1b[0m`)
                    erd.eval(k.ws, v.content)
                })
            } catch (err) { console.error(err) } finally { windowsVisited.push(k.id) }
        })
    }, 1000)
}

if (checkArgs()) startInject()