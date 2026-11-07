import { Type } from '@sinclair/typebox'

export const ModelIDRegExp = /^[A-Za-z0-9+_-]+$/

export const TransformType = {
	Shadow: 'shadow',
	Messages: 'messages',
} as const
export type TransformType = (typeof TransformType)[keyof typeof TransformType]
export type Transform = {
	type: TransformType
	match: string
	transform: string
}

export const FrontMatter = Type.Object({
	type: Type.Union([Type.Literal('shadow'), Type.Literal('messages')]),
})
