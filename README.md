# Electool

Tools for Electron based apps

## Installation

Make sure you have NodeJS and NPM installed properly.

Inside the downloaded folder :

```batch
npm install
```

## Usage

```batch
> node index.js -h
Usage: index [options] [command]

Options:
  -v, --version            Output the current version of the program
  -h, --help               display help for command

Commands:
  debug [options] <app>    Injects various things into the specified electron app
                           If --devkeys doesn't work, try pressing CTRL + SHIFT + I
  pack [options] <folder>  Pack the inserted folder into .asar file
  unpack <file>            Unpack the .asar file to get the source code of the app
  help [command]           display help for command
```

## Problems

- I don't know how to build all in one executable
- I don't know how to enable devtools without using the --browser argument

## Credits

Thanks to [tintinweb](https://github.com/tintinweb/electron-inject) for the main idea and the source code.