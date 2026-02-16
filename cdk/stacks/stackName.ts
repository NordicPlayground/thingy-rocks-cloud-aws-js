export const STACK_NAME = process.env.STACK_NAME ?? 'thingy-rocks-backend'
export const UDP_INGEST_STACK_NAME =
	process.env.UDP_INGEST_STACK_NAME ?? `${STACK_NAME}-udp`
export const USER_STACK_NAME =
	process.env.USER_STACK_NAME ?? `${STACK_NAME}-user`
export const ASSET_TRACKER_STACK_NAME =
	process.env.ASSET_TRACKER_STACK_NAME ?? 'nrf-asset-tracker'
export const NRPLUS_STACK_NAME =
	process.env.NRPLUS_STACK_NAME ?? `${STACK_NAME}-nrplus`
export const NRPLUS_DEMO_STACK_NAME =
	process.env.NRPLUS_DEMO_STACK_NAME ?? `${STACK_NAME}-nrplus-demo`
export const VIDEO_INTEGRATION_STACK_NAME =
	process.env.VIDEO_INTEGRATION_STACK_NAME ?? `${STACK_NAME}-video-integration`
