import fs from "fs"
import nexe from "nexe"
import path from "path"
const pjson = JSON.parse(fs.readFileSync("package.json"))

let platforms = [
    { platform: "Windows", target: "windows-x64-14.15.3" }, 
    { platform: "MacOS", target: "mac-x64-14.15.3" },
    { platform: "Linux", target: "linux-x86-14.15.3" }
]

platforms.forEach(e => {
    nexe.compile({
        input: "./" + pjson.main,
        build: false,
        output: path.join("dist", e.platform, pjson.name),
        targets: e.target
    }).then(() => console.log(`\x1b[32m${e.platform} build compiled successfully !\x1b[0m`))
    .catch(err => console.error(err))
})
