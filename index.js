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

var scripts = []

const program = new Command()
    .version(`v${pjson.version} by zAlweNy26`, '-v, --version', 'Output the current version of the program')
    .configureOutput({ outputError: (str, write) => write(`\x1b[31m${str}\x1b[0m`) })
    
program.command("debug <app>", { isDefault: true })
    .description("Injects various things into the specified electron app\nIf --devkeys doesn't work, try pressing CTRL + SHIFT + I")
    .option('-p, --port <port>', 'Launch with a specific port', convertToInteger)
    .option('-t, --timeout <seconds>', 'Time to wait before stop trying to inject', convertToInteger)
    .option('-s, --scripts <folder>', 'Add scripts to be injected into each window (render thread)')
    .option('-d, --devkeys', 'Enable hotkeys F12 (toggle developer tools) and F5 (refresh)')
    .option('-b, --browser', 'Launch devtools in default browser')
    .action(async (app, options) => {
        try {
            let fl = fs.statSync(app)
            if (fl == null || !fl.isFile() || path.extname(app) != ".exe") throw new Error()
            if (options.scripts != undefined) {
                let folder = fs.statSync(options.scripts)
                if (folder == null || !folder.isDirectory()) throw new Error()
                fs.readdirSync(options.scripts).forEach(file => {
                    let fileSize = fs.statSync(path.join(options.scripts, file))
                    let data = fs.readFileSync(path.join(options.scripts, file), "utf-8")
                    scripts.push({ name: file, content: data, size: formatBytes(fileSize.size)})
                })
            }
            let timeout = options.timeout == undefined ? 5 : options.timeout
            let erd = new ElectronRemoteDebugger("localhost", options.port)
            await erd.execute(app, timeout)
            let windowsVisited = []
            console.log(`\x1b[33mSearching for ${timeout} seconds...\x1b[0m`)
            let timer = setInterval(async () => {
                let ws = await erd.windows()
                if (--timeout == 0 || ws.every(cv => windowsVisited.includes(cv.id))) {
                    if (options.browser) erd.start(`http://${erd.host}:${erd.port}/`)
                    clearInterval(timer)
                }
                let notws = ws.filter(x => !windowsVisited.includes(x.id) && x.title != "")
                notws.forEach(k => {
                    try {
                        if (options.devkeys) {
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
        } catch (error) {
            console.log("\x1b[31mThe inserted file path was not found or is not valid !\x1b[0m")
        }
    })

program.command("pack <folder>")
    .description('Unpack the .asar file to get the source code of the app')
    .action(fdr => {
        try {
            let unpacked = fs.statSync(fdr)
            if (unpacked == null || !unpacked.isDirectory()) throw new Error()
            else {
                console.log(`\x1b[33mStarted packing the folder...\x1b[0m`)
                asar.createPackage(fdr, "./app.asar")
                .then(() => console.log(`\x1b[32mThe inserted folder was packed successfully !\x1b[0m`))
                .catch(err => console.log(`\x1b[31mAn error as occurred while packing the folder !\x1b[0m`))
            }
        } catch (error) {
            console.log("\x1b[31mThe inserted directory path was not found or is not valid !\x1b[0m")
        }
    })

program.command("unpack <file>")
    .description('Pack the inserted folder into .asar file')
    .action(fl => {
        try {
            let packed = fs.statSync(fl)
            if (packed == null || !packed.isFile() || path.extname(fl) != ".asar") throw new Error()
            else {
                console.log(`\x1b[33mStarted unpacking the .asar file...\x1b[0m`)
                asar.extractAll(fl, "./unpacked")
                console.log(`\x1b[32mThe .asar file was unpacked successfully !\x1b[0m`)
            }
        } catch (error) {
            console.log("\x1b[31mThe inserted file path was not found or is not valid !\x1b[0m")
        }
    })

program.parse(process.argv)