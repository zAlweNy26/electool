import fs from "fs"
import path from "path"
import asar from "asar"
import ps from "ps-node"
import commander, { Command } from "commander"
import ElectronRemoteDebugger from "./debugger.js"
import { formatBytes, injectCSS, injectJS } from "./functions.js";
const pjson = JSON.parse(fs.readFileSync("package.json"))

const devToolsKeysScript = `document.addEventListener("keydown", e => {
    if (e.keyCode === 123) { // F12
        require("electron").remote.BrowserWindow.getFocusedWindow().webContents.toggleDevTools()
        console.log("DevTools enabled !")
    } else if (e.keyCode === 116) { // F5
        location.reload()
        console.log("All scripts were removed because of reloading !")
    }
})`

var scripts = []
var styles = []

function convertToInteger(value) {
    const parsedValue = parseInt(value, 10)
    if (isNaN(parsedValue) || parsedValue < 0) 
        throw new commander.InvalidArgumentError('The inserted value is not a valid number.')
    return parsedValue
}

async function startInjecting(app, options) {
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
                    console.log(`\x1b[36mInjecting ${v.name} (${v.size}) into "${k.title}" (${k.id})\x1b[0m`)
                    erd.eval(k.ws, v.content)
                })
                styles.forEach(v => {
                    console.log(`\x1b[35mInjecting ${v.name} (${v.size}) into "${k.title}" (${k.id})\x1b[0m`)
                    let cssInjectScript = `const customStyle = document.createElement('style')
                        customStyle.textContent = \`\\n${v.content}\\n\`
                        document.head.append(customStyle)`
                    erd.eval(k.ws, cssInjectScript)
                })
            } catch (err) { console.error(err) } finally { windowsVisited.push(k.id) }
        })
    }, 1000)
}

const program = new Command()
    .version(`v${pjson.version} by zAlweNy26`, '-v, --version', 'Output the current version of the program')
    .configureOutput({ outputError: (str, write) => write(`\x1b[31m${str}\x1b[0m`) })
    
program.command("debug <app>", { isDefault: true })
    .description("Injects various things into the specified electron app\nIf --devkeys doesn't work, try pressing CTRL + SHIFT + I")
    .option('-p, --port <port>', 'Launch with a specific port', convertToInteger)
    .option('-t, --timeout <seconds>', 'Time to wait before stop trying to inject', convertToInteger)
    .option('-s, --scripts <folder>', 'Add scripts to be injected into each window (render thread)')
    .option('-c, --css <folder>', 'Add styles to be injected into each window (render thread)')
    .option('-d, --devkeys', 'Enable hotkeys F12 (toggle developer tools) and F5 (refresh)')
    .option('-b, --browser', 'Launch devtools in default browser')
    .action((app, options) => {
        try {
            let fl = fs.statSync(app)
            if (fl == null || !fl.isFile() || path.extname(app) != ".exe") throw new Error()
            try {
                if (options.scripts != undefined) {
                    let folder = fs.statSync(path.resolve(options.scripts))
                    if (folder == null || !folder.isDirectory()) throw "\x1b[31mThe inserted folder path was not found or is not valid !\x1b[0m"
                    fs.readdirSync(path.resolve(options.scripts)).forEach(file => {
                        let stat = fs.statSync(path.join(path.resolve(options.scripts), file))
                        let data = fs.readFileSync(path.join(path.resolve(options.scripts), file), "utf-8")
                        if (path.extname(file) == ".js") scripts.push({ name: path.basename(file), content: data, size: formatBytes(stat.size)})
                    })
                }
                if (options.css != undefined) {
                    let folder = fs.statSync(path.resolve(options.css))
                    if (folder == null || !folder.isDirectory()) throw "\x1b[31mThe inserted folder path was not found or is not valid !\x1b[0m"
                    fs.readdirSync(path.resolve(options.css)).forEach(file => {
                        let stat = fs.statSync(path.join(path.resolve(options.css), file))
                        let data = fs.readFileSync(path.join(path.resolve(options.css), file), "utf-8")
                        if (path.extname(file) == ".css") styles.push({ name: path.basename(file), content: data, size: formatBytes(stat.size)})
                    })
                }
                console.log(`\x1b[33mSearching the process...\x1b[0m`)
                ps.lookup({ command: path.basename(app), psargs: 'ux' }, (err, resultList) => {
                    if (err) throw "\x1b[31mUnable to find this process.\x1b[0m"
                    if (resultList.length) {
                        ps.kill(resultList[0].pid, { signal: 'SIGTERM' }, err => {
                            if (err) throw "\x1b[31mUnable to kill this process. Please close it manually.\x1b[0m"
                            else {
                                console.log(`\x1b[33mClosing the current process ${path.basename(app)} (${resultList[0].pid})...\x1b[0m`)
                                startInjecting(app, options)
                            }
                        })
                    } else startInjecting(app, options)
                })
            } catch (err) { console.log(err) }
        } catch (error) { console.log("\x1b[31mThe inserted file path was not found or is not valid !\x1b[0m") }
    })

program.command("pack <folder>")
    .description('Pack the inserted folder into .asar file')
    .option('-s, --scripts <scripts...>', 'Specify the .js files to include inside the packed .asar file\nRemember : the order is important !')
    .option('-c, --css <styles...>', 'Specify the .css files to link inside the packed .asar file\nRemember : the order is important !')
    .action((fdr, options) => {
        try {
            let unpacked = fs.statSync(fdr)
            if (unpacked == null || !unpacked.isDirectory()) throw new Error()
            else {
                if (options.css != undefined) injectCSS(fdr, options.css)
                if (options.scripts != undefined) injectJS(fdr, options.scripts)
                if (options.scripts != undefined || options.css != undefined) console.log(`\x1b[32mEach .html file was updated successfully !\x1b[0m`)
                console.log(`\x1b[33mStarted packing the folder...\x1b[0m`)
                asar.createPackage(fdr, "./app.asar")
                .then(() => {
                    console.log(`\x1b[32mThe inserted folder was packed successfully !\x1b[0m`)
                    console.log(`\x1b[33mMake sure to create a backup of the original .asar file before replacing it !\x1b[0m`)
                })
                .catch(err => console.log(`\x1b[31mAn error as occurred while packing the folder !\x1b[0m`))
            }
        } catch (error) { console.log("\x1b[31mThe inserted folder path was not found or is not valid !\x1b[0m") }
    })

program.command("unpack <file>")
    .description('Unpack the .asar file to get the source code of the app')
    .action(fl => {
        try {
            let packed = fs.statSync(fl)
            if (packed == null || !packed.isFile() || path.extname(fl) != ".asar") throw new Error()
            else {
                console.log(`\x1b[33mStarted unpacking the .asar file...\x1b[0m`)
                asar.extractAll(fl, "./unpacked")
                console.log(`\x1b[32mThe .asar file was unpacked successfully !\x1b[0m`)
            }
        } catch (error) { console.log("\x1b[31mThe inserted file path was not found or is not valid !\x1b[0m") }
    })

program.parse(process.argv)