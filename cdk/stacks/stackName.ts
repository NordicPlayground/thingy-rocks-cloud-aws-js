export const STACK_NAME = process.env.STACK_NAME ?? 'thingy-rocks-backend'
export const UDP_INGEST_STACK_NAME =
	process.env.UDP_INGEST_STACK_NAME ?? `${STACK_NAME}-udp`
export const ASSET_TRACKER_STACK_NAME =
	process.env.ASSET_TRACKER_STACK_NAME ?? 'nrf-asset-tracker'
