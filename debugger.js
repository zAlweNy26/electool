import net from "net"
import WebSocket from "ws"
import fetch from "node-fetch"
import cmd from "child_process"

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
}

class ElectronRemoteDebugger {
    constructor(host, port = null) {
        this.host = host
        if (port == null || port == undefined) {
            let srv = net.createServer()
            srv.listen(0)
            this.port = srv.address().port
            srv.close()
        } else this.port = port
    }
    start(url) {
        let start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open')
        cmd.exec(start + " " + url)
    }
    async execute(path, timeout) {
        let cmd = `${path} --remote-debugging-port=${this.port}`
        console.log(`\x1b[32mExecuting ${cmd}\x1b[0m`)
        this.start(cmd)
        for (let i = 0; i < timeout * 5; i++) {
            await sleep(1000)
            let esc = await new Promise(async (resolve, reject) => {
                let client = net.createConnection(this.port, this.host, () => {
                    console.log(`\x1b[32mConnection enstabilished !\x1b[0m`)
                    resolve(true)
                })
                client.on("error", e => reject())
            }).catch(err => console.error("\x1b[31mConnection refused !\x1b[0m"))
            if (esc) break
        }
    }
    async windows() {
        let ts = Math.round(Date.now() / 1000)
        let ret = []
        try {
            const res = await fetch(`http://${this.host}:${this.port}/json/list?t=${ts}`)
            if (res.status >= 400) throw new Error()
            const json = await res.json()
            for (let k in json)
                ret.push({
                    id: json[k].id,
                    title: json[k].title,
                    ws: new WebSocket(json[k].webSocketDebuggerUrl)
                })
            return ret
        } catch (err) { return console.error("\x1b[31mBad response from the server\x1b[0m") }
    }
    eval(ws, exp) {
        let data = {
            'id': 1,
            'method': "Runtime.evaluate",
            'params': {
                'contextId': 1,
                'doNotPauseOnExceptionsAndMuteConsole': false,
                'expression': exp,
                'generatePreview': false,
                'includeCommandLineAPI': true,
                'objectGroup': 'console',
                'returnByValue': false,
                'userGesture': true
            }
        }
        ws.on('open', () => ws.send(JSON.stringify(data)))
    }
}

export default ElectronRemoteDebugger