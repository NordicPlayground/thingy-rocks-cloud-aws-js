/* eslint-disable */
// @generated by protobuf-ts 2.8.2 with parameter ts_nocheck,eslint_disable
// @generated from protobuf file "wp_global.proto" (package "wirepas.proto.gateway_api", syntax proto2)
// tslint:disable
// @ts-nocheck
import type {
	BinaryReadOptions,
	BinaryWriteOptions,
	IBinaryReader,
	IBinaryWriter,
	PartialMessage,
} from '@protobuf-ts/runtime'
import {
	MESSAGE_TYPE,
	MessageType,
	UnknownFieldHandler,
	WireType,
	reflectionMergePartial,
} from '@protobuf-ts/runtime'
import { ErrorCode } from './error.js'
/**
 * Global request header
 * NB: Gateway id is not present in header as gateway will only subscribe to their id
 *
 * @generated from protobuf message wirepas.proto.gateway_api.RequestHeader
 */
export interface RequestHeader {
	/**
	 * Unique request id
	 *
	 * @generated from protobuf field: uint64 req_id = 1;
	 */
	reqId: bigint
	/**
	 * Sink id if relevant for request
	 *
	 * @generated from protobuf field: optional string sink_id = 2;
	 */
	sinkId?: string
}
/**
 * @generated from protobuf message wirepas.proto.gateway_api.ResponseHeader
 */
export interface ResponseHeader {
	/**
	 * Same as in Request
	 *
	 * @generated from protobuf field: uint64 req_id = 1;
	 */
	reqId: bigint
	/**
	 * Gw id that handled the request
	 *
	 * @generated from protobuf field: string gw_id = 2;
	 */
	gwId: string
	/**
	 * Sink id if relevant for request
	 *
	 * @generated from protobuf field: optional string sink_id = 3;
	 */
	sinkId?: string
	/**
	 * Global result of request
	 *
	 * @generated from protobuf field: wirepas.proto.gateway_api.ErrorCode res = 4;
	 */
	res: ErrorCode
}
/**
 * @generated from protobuf message wirepas.proto.gateway_api.EventHeader
 */
export interface EventHeader {
	/**
	 * Gw id that generated the event
	 *
	 * @generated from protobuf field: string gw_id = 1;
	 */
	gwId: string
	/**
	 * Sink id if relevant for event
	 *
	 * @generated from protobuf field: optional string sink_id = 2;
	 */
	sinkId?: string
	/**
	 * Random event id to help duplicate event filtering
	 *
	 * @generated from protobuf field: uint64 event_id = 3;
	 */
	eventId: bigint
}
/**
 * @generated from protobuf message wirepas.proto.gateway_api.FirmwareVersion
 */
export interface FirmwareVersion {
	/**
	 * @generated from protobuf field: uint32 major = 1;
	 */
	major: number
	/**
	 * @generated from protobuf field: uint32 minor = 2;
	 */
	minor: number
	/**
	 * @generated from protobuf field: uint32 maint = 3;
	 */
	maint: number
	/**
	 * @generated from protobuf field: uint32 dev = 4;
	 */
	dev: number
}
/**
 * @generated from protobuf enum wirepas.proto.gateway_api.OnOffState
 */
export enum OnOffState {
	/**
	 * @generated synthetic value - protobuf-ts requires all enums to have a 0 value
	 */
	UNSPECIFIED$ = 0,
	/**
	 * @generated from protobuf enum value: ON = 1;
	 */
	ON = 1,
	/**
	 * @generated from protobuf enum value: OFF = 2;
	 */
	OFF = 2,
}
// @generated message type with reflection information, may provide speed optimized methods
class RequestHeader$Type extends MessageType<RequestHeader> {
	constructor() {
		super('wirepas.proto.gateway_api.RequestHeader', [
			{
				no: 1,
				name: 'req_id',
				kind: 'scalar',
				T: 4 /*ScalarType.UINT64*/,
				L: 0 /*LongType.BIGINT*/,
			},
			{
				no: 2,
				name: 'sink_id',
				kind: 'scalar',
				opt: true,
				T: 9 /*ScalarType.STRING*/,
				options: { nanopb: { maxSize: 128 } },
			},
		])
	}
	create(value?: PartialMessage<RequestHeader>): RequestHeader {
		const message = { reqId: 0n }
		globalThis.Object.defineProperty(message, MESSAGE_TYPE, {
			enumerable: false,
			value: this,
		})
		if (value !== undefined)
			reflectionMergePartial<RequestHeader>(this, message, value)
		return message
	}
	internalBinaryRead(
		reader: IBinaryReader,
		length: number,
		options: BinaryReadOptions,
		target?: RequestHeader,
	): RequestHeader {
		let message = target ?? this.create(),
			end = reader.pos + length
		while (reader.pos < end) {
			let [fieldNo, wireType] = reader.tag()
			switch (fieldNo) {
				case /* uint64 req_id */ 1:
					message.reqId = reader.uint64().toBigInt()
					break
				case /* optional string sink_id */ 2:
					message.sinkId = reader.string()
					break
				default:
					let u = options.readUnknownField
					if (u === 'throw')
						throw new globalThis.Error(
							`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
						)
					let d = reader.skip(wireType)
					if (u !== false)
						(u === true ? UnknownFieldHandler.onRead : u)(
							this.typeName,
							message,
							fieldNo,
							wireType,
							d,
						)
			}
		}
		return message
	}
	internalBinaryWrite(
		message: RequestHeader,
		writer: IBinaryWriter,
		options: BinaryWriteOptions,
	): IBinaryWriter {
		/* uint64 req_id = 1; */
		if (message.reqId !== 0n)
			writer.tag(1, WireType.Varint).uint64(message.reqId)
		/* optional string sink_id = 2; */
		if (message.sinkId !== undefined)
			writer.tag(2, WireType.LengthDelimited).string(message.sinkId)
		let u = options.writeUnknownFields
		if (u !== false)
			(u == true ? UnknownFieldHandler.onWrite : u)(
				this.typeName,
				message,
				writer,
			)
		return writer
	}
}
/**
 * @generated MessageType for protobuf message wirepas.proto.gateway_api.RequestHeader
 */
export const RequestHeader = new RequestHeader$Type()
// @generated message type with reflection information, may provide speed optimized methods
class ResponseHeader$Type extends MessageType<ResponseHeader> {
	constructor() {
		super('wirepas.proto.gateway_api.ResponseHeader', [
			{
				no: 1,
				name: 'req_id',
				kind: 'scalar',
				T: 4 /*ScalarType.UINT64*/,
				L: 0 /*LongType.BIGINT*/,
			},
			{
				no: 2,
				name: 'gw_id',
				kind: 'scalar',
				T: 9 /*ScalarType.STRING*/,
				options: { nanopb: { maxSize: 128 } },
			},
			{
				no: 3,
				name: 'sink_id',
				kind: 'scalar',
				opt: true,
				T: 9 /*ScalarType.STRING*/,
				options: { nanopb: { maxSize: 128 } },
			},
			{
				no: 4,
				name: 'res',
				kind: 'enum',
				T: () => ['wirepas.proto.gateway_api.ErrorCode', ErrorCode],
			},
		])
	}
	create(value?: PartialMessage<ResponseHeader>): ResponseHeader {
		const message = { reqId: 0n, gwId: '', res: 0 }
		globalThis.Object.defineProperty(message, MESSAGE_TYPE, {
			enumerable: false,
			value: this,
		})
		if (value !== undefined)
			reflectionMergePartial<ResponseHeader>(this, message, value)
		return message
	}
	internalBinaryRead(
		reader: IBinaryReader,
		length: number,
		options: BinaryReadOptions,
		target?: ResponseHeader,
	): ResponseHeader {
		let message = target ?? this.create(),
			end = reader.pos + length
		while (reader.pos < end) {
			let [fieldNo, wireType] = reader.tag()
			switch (fieldNo) {
				case /* uint64 req_id */ 1:
					message.reqId = reader.uint64().toBigInt()
					break
				case /* string gw_id */ 2:
					message.gwId = reader.string()
					break
				case /* optional string sink_id */ 3:
					message.sinkId = reader.string()
					break
				case /* wirepas.proto.gateway_api.ErrorCode res */ 4:
					message.res = reader.int32()
					break
				default:
					let u = options.readUnknownField
					if (u === 'throw')
						throw new globalThis.Error(
							`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
						)
					let d = reader.skip(wireType)
					if (u !== false)
						(u === true ? UnknownFieldHandler.onRead : u)(
							this.typeName,
							message,
							fieldNo,
							wireType,
							d,
						)
			}
		}
		return message
	}
	internalBinaryWrite(
		message: ResponseHeader,
		writer: IBinaryWriter,
		options: BinaryWriteOptions,
	): IBinaryWriter {
		/* uint64 req_id = 1; */
		if (message.reqId !== 0n)
			writer.tag(1, WireType.Varint).uint64(message.reqId)
		/* string gw_id = 2; */
		if (message.gwId !== '')
			writer.tag(2, WireType.LengthDelimited).string(message.gwId)
		/* optional string sink_id = 3; */
		if (message.sinkId !== undefined)
			writer.tag(3, WireType.LengthDelimited).string(message.sinkId)
		/* wirepas.proto.gateway_api.ErrorCode res = 4; */
		if (message.res !== 0) writer.tag(4, WireType.Varint).int32(message.res)
		let u = options.writeUnknownFields
		if (u !== false)
			(u == true ? UnknownFieldHandler.onWrite : u)(
				this.typeName,
				message,
				writer,
			)
		return writer
	}
}
/**
 * @generated MessageType for protobuf message wirepas.proto.gateway_api.ResponseHeader
 */
export const ResponseHeader = new ResponseHeader$Type()
// @generated message type with reflection information, may provide speed optimized methods
class EventHeader$Type extends MessageType<EventHeader> {
	constructor() {
		super('wirepas.proto.gateway_api.EventHeader', [
			{
				no: 1,
				name: 'gw_id',
				kind: 'scalar',
				T: 9 /*ScalarType.STRING*/,
				options: { nanopb: { maxSize: 128 } },
			},
			{
				no: 2,
				name: 'sink_id',
				kind: 'scalar',
				opt: true,
				T: 9 /*ScalarType.STRING*/,
				options: { nanopb: { maxSize: 128 } },
			},
			{
				no: 3,
				name: 'event_id',
				kind: 'scalar',
				T: 4 /*ScalarType.UINT64*/,
				L: 0 /*LongType.BIGINT*/,
			},
		])
	}
	create(value?: PartialMessage<EventHeader>): EventHeader {
		const message = { gwId: '', eventId: 0n }
		globalThis.Object.defineProperty(message, MESSAGE_TYPE, {
			enumerable: false,
			value: this,
		})
		if (value !== undefined)
			reflectionMergePartial<EventHeader>(this, message, value)
		return message
	}
	internalBinaryRead(
		reader: IBinaryReader,
		length: number,
		options: BinaryReadOptions,
		target?: EventHeader,
	): EventHeader {
		let message = target ?? this.create(),
			end = reader.pos + length
		while (reader.pos < end) {
			let [fieldNo, wireType] = reader.tag()
			switch (fieldNo) {
				case /* string gw_id */ 1:
					message.gwId = reader.string()
					break
				case /* optional string sink_id */ 2:
					message.sinkId = reader.string()
					break
				case /* uint64 event_id */ 3:
					message.eventId = reader.uint64().toBigInt()
					break
				default:
					let u = options.readUnknownField
					if (u === 'throw')
						throw new globalThis.Error(
							`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
						)
					let d = reader.skip(wireType)
					if (u !== false)
						(u === true ? UnknownFieldHandler.onRead : u)(
							this.typeName,
							message,
							fieldNo,
							wireType,
							d,
						)
			}
		}
		return message
	}
	internalBinaryWrite(
		message: EventHeader,
		writer: IBinaryWriter,
		options: BinaryWriteOptions,
	): IBinaryWriter {
		/* string gw_id = 1; */
		if (message.gwId !== '')
			writer.tag(1, WireType.LengthDelimited).string(message.gwId)
		/* optional string sink_id = 2; */
		if (message.sinkId !== undefined)
			writer.tag(2, WireType.LengthDelimited).string(message.sinkId)
		/* uint64 event_id = 3; */
		if (message.eventId !== 0n)
			writer.tag(3, WireType.Varint).uint64(message.eventId)
		let u = options.writeUnknownFields
		if (u !== false)
			(u == true ? UnknownFieldHandler.onWrite : u)(
				this.typeName,
				message,
				writer,
			)
		return writer
	}
}
/**
 * @generated MessageType for protobuf message wirepas.proto.gateway_api.EventHeader
 */
export const EventHeader = new EventHeader$Type()
// @generated message type with reflection information, may provide speed optimized methods
class FirmwareVersion$Type extends MessageType<FirmwareVersion> {
	constructor() {
		super('wirepas.proto.gateway_api.FirmwareVersion', [
			{ no: 1, name: 'major', kind: 'scalar', T: 13 /*ScalarType.UINT32*/ },
			{ no: 2, name: 'minor', kind: 'scalar', T: 13 /*ScalarType.UINT32*/ },
			{ no: 3, name: 'maint', kind: 'scalar', T: 13 /*ScalarType.UINT32*/ },
			{ no: 4, name: 'dev', kind: 'scalar', T: 13 /*ScalarType.UINT32*/ },
		])
	}
	create(value?: PartialMessage<FirmwareVersion>): FirmwareVersion {
		const message = { major: 0, minor: 0, maint: 0, dev: 0 }
		globalThis.Object.defineProperty(message, MESSAGE_TYPE, {
			enumerable: false,
			value: this,
		})
		if (value !== undefined)
			reflectionMergePartial<FirmwareVersion>(this, message, value)
		return message
	}
	internalBinaryRead(
		reader: IBinaryReader,
		length: number,
		options: BinaryReadOptions,
		target?: FirmwareVersion,
	): FirmwareVersion {
		let message = target ?? this.create(),
			end = reader.pos + length
		while (reader.pos < end) {
			let [fieldNo, wireType] = reader.tag()
			switch (fieldNo) {
				case /* uint32 major */ 1:
					message.major = reader.uint32()
					break
				case /* uint32 minor */ 2:
					message.minor = reader.uint32()
					break
				case /* uint32 maint */ 3:
					message.maint = reader.uint32()
					break
				case /* uint32 dev */ 4:
					message.dev = reader.uint32()
					break
				default:
					let u = options.readUnknownField
					if (u === 'throw')
						throw new globalThis.Error(
							`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
						)
					let d = reader.skip(wireType)
					if (u !== false)
						(u === true ? UnknownFieldHandler.onRead : u)(
							this.typeName,
							message,
							fieldNo,
							wireType,
							d,
						)
			}
		}
		return message
	}
	internalBinaryWrite(
		message: FirmwareVersion,
		writer: IBinaryWriter,
		options: BinaryWriteOptions,
	): IBinaryWriter {
		/* uint32 major = 1; */
		if (message.major !== 0)
			writer.tag(1, WireType.Varint).uint32(message.major)
		/* uint32 minor = 2; */
		if (message.minor !== 0)
			writer.tag(2, WireType.Varint).uint32(message.minor)
		/* uint32 maint = 3; */
		if (message.maint !== 0)
			writer.tag(3, WireType.Varint).uint32(message.maint)
		/* uint32 dev = 4; */
		if (message.dev !== 0) writer.tag(4, WireType.Varint).uint32(message.dev)
		let u = options.writeUnknownFields
		if (u !== false)
			(u == true ? UnknownFieldHandler.onWrite : u)(
				this.typeName,
				message,
				writer,
			)
		return writer
	}
}
/**
 * @generated MessageType for protobuf message wirepas.proto.gateway_api.FirmwareVersion
 */
export const FirmwareVersion = new FirmwareVersion$Type()
