# Electool

Tools for Electron based apps

## Installation

Inside the downloaded folder :

```batch
npm install
```

## Usage

```batch
> node index.js -h

Usage: index <app> [options]

Injects various things into the specified electron app

Options:
  -p, --port <port>        launch with a specific port
  -t, --timeout <seconds>  time to wait before stop trying to inject
  -s, --scripts <folder>   add scripts to be injected into each window (render thread)
  -d, --devkeys            enable hotkeys F12 (toggle developer tools) and F5 (refresh)
  -b, --browser            launch devtools in default browser
  -u, --unpack <file>      unpack the .asar file to get the source code of the app
  -p, --pack <folder>      pack the inserted folder into .asar file
  -v, --version            output the current version of the program
  -h, --help               display help for command
```

## Problems

- I don't know how to build all in one executable
- I don't know how to enable devtools without using the --browser argument

## Credits

Thanks to [tintinweb](https://github.com/tintinweb/electron-inject) for the main idea and the source code.