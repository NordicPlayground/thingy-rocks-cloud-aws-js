import { type Transform, TransformType } from './types.ts'

export type Model = {
	/**
	 * The Model ID
	 */
	id: string
	/**
	 * The transforms defined for this model.
	 */
	transforms: Array<Transform>
}

export const Asset_tracker_v2_AWS: Model = {
	id: 'asset_tracker_v2+AWS',
	transforms: [
		{
			type: TransformType.Shadow,
			match: '$exists(state.reported.gnss)',
			transform:
				'[\n    {"bn": "14201/0/", "n": "0", "v": state.reported.gnss.v.lat, "bt": $floor(state.reported.gnss.ts/1000) },\n    {"n": "1", "v": state.reported.gnss.v.lng },\n    {"n": "2", "v": state.reported.gnss.v.alt },\n    {"n": "3", "v": state.reported.gnss.v.acc },\n    {"n": "4", "v": state.reported.gnss.v.spd },\n    {"n": "5", "v": state.reported.gnss.v.hdg },\n    {"n": "6", "vs": "GNSS" }\n]',
		},
		// hellaPHY Location / LTE precision location (LPL)
		{
			type: TransformType.Shadow,
			match: '$exists(state.reported.lpl)',
			transform:
				'[\n    {"bn": "14201/3/", "n": "0", "v": state.reported.lpl.v.lat, "bt": $floor(state.reported.lpl.ts/1000) },\n    {"n": "1", "v": state.reported.lpl.v.lng },\n    {"n": "2", "v": state.reported.lpl.v.alt },\n    {"n": "3", "v": state.reported.lpl.v.acc },\n    {"n": "4", "v": state.reported.lpl.v.spd },\n    {"n": "5", "v": state.reported.lpl.v.hdg },\n    {"n": "6", "vs": "LPL" }\n]',
		},
		{
			type: TransformType.Shadow,
			match: '$exists(state.reported.bat)',
			transform:
				'[\n    {"bn": "14202/0/", "n": "1", "v": state.reported.bat.v/1000, "bt": $floor(state.reported.bat.ts/1000) }\n]',
		},
		{
			type: TransformType.Shadow,
			match: '$exists(state.reported.dev)',
			transform:
				'[\n    {"bn": "14204/0/", "n": "0", "vs": state.reported.dev.v.imei, "bt": $floor(state.reported.dev.ts/1000) },\n    {"n": "1", "vs": state.reported.dev.v.iccid },\n    {"n": "2", "vs": state.reported.dev.v.modV },\n    {"n": "3", "vs": state.reported.dev.v.appV },\n    {"n": "4", "vs": state.reported.dev.v.brdV }\n]',
		},
		{
			type: TransformType.Shadow,
			match: '$exists(state.reported.env)',
			transform:
				'[\n    {"bn": "14205/0/", "n": "0", "v": state.reported.env.v.temp, "bt": $floor(state.reported.env.ts/1000) },\n    {"n": "1", "v": state.reported.env.v.hum },\n    {"n": "2", "v": state.reported.env.v.atmp },\n    {"n": "10", "v": state.reported.env.v.bsec_iaq }\n]',
		},
		{
			type: TransformType.Shadow,
			match: '$exists(state.reported.fg)',
			transform:
				'[\n    {"bn": "14202/0/", "n": "0", "v": state.reported.fg.v.SoC, "bt": $floor(state.reported.fg.ts/1000) },\n    {"n": "1", "v": state.reported.fg.v.V/1000 },\n    {"n": "2", "v": state.reported.fg.v.I },\n    {"n": "3", "v": state.reported.fg.v.T = null ? null : state.reported.fg.v.T/10 },\n    {"n": "4", "v": state.reported.fg.v.TTF },\n    {"n": "5", "v": state.reported.fg.v.TTE }\n]',
		},
		{
			type: TransformType.Shadow,
			match: '$exists(state.reported.roam)',
			transform:
				'[\n    {"bn": "14203/0/", "n": "0", "vs": state.reported.roam.v.nw, "bt": $floor(state.reported.roam.ts/1000) },\n    {"n": "1", "v": state.reported.roam.v.band },\n    {"bn": "14203/0/", "n": "2", "v": state.reported.roam.v.rsrp, "bt": $floor(state.reported.roam.ts/1000) },\n    {"n": "3", "v": state.reported.roam.v.area },\n    {"n": "4", "v": state.reported.roam.v.cell },\n    {"n": "5", "v": state.reported.roam.v.mccmnc },\n    {"n": "6", "vs": state.reported.roam.v.ip },\n    {"bn": "14203/0/", "n": "11", "v": state.reported.roam.v.eest, "bt": $floor(state.reported.roam.ts/1000) }\n]',
		},
		{
			type: TransformType.Shadow,
			match: '$exists(state.reported.sol)',
			transform:
				'[\n    {"bn": "14210/0/", "n": "0", "v": state.reported.sol.v.gain, "bt": $floor(state.reported.sol.ts/1000) },\n    {"n": "1", "v": state.reported.sol.v.bat }\n]',
		},
	],
}
