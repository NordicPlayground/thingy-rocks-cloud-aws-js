import { Type } from '@sinclair/typebox'

export const ModelIDRegExp = /^[A-Za-z0-9+_-]+$/

export enum TransformType {
	Shadow = 'shadow',
	Messages = 'messages',
}
export type Transform = {
	type: TransformType
	match: string
	transform: string
}

export const FrontMatter = Type.Object({
	type: Type.Union([Type.Literal('shadow'), Type.Literal('messages')]),
})
