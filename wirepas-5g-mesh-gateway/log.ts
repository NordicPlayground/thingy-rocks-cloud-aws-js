import chalk from 'chalk'

const ts = () => chalk.gray(`[${new Date().toISOString()}]`)

export const log = (...args: any[]): void => {
	console.log(ts(), ...args)
}
export const debug = (...args: any[]): void => {
	console.debug(ts(), ...args)
}
export const error = (...args: any[]): void => {
	console.error(ts(), ...args)
}
