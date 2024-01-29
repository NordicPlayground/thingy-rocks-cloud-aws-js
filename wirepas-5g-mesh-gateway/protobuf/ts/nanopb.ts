/* eslint-disable */
// @generated by protobuf-ts 2.8.2 with parameter ts_nocheck,eslint_disable
// @generated from protobuf file "nanopb.proto" (syntax proto2)
// tslint:disable
// @ts-nocheck
//
// Custom options for defining:
// - Maximum size of string/bytes
// - Maximum number of elements in array
//
// These are used by nanopb to generate statically allocable structures
// for memory-limited environments.
//
import type {
	BinaryReadOptions,
	BinaryWriteOptions,
	IBinaryReader,
	IBinaryWriter,
	PartialMessage,
} from '@protobuf-ts/runtime'
import {
	MessageType,
	MESSAGE_TYPE,
	reflectionMergePartial,
	UnknownFieldHandler,
	WireType,
} from '@protobuf-ts/runtime'
/**
 * This is the inner options message, which basically defines options for
 * a field. When it is used in message or file scope, it applies to all
 * fields.
 *
 * @generated from protobuf message NanoPBOptions
 */
export interface NanoPBOptions {
	/**
	 * Allocated size for 'bytes' and 'string' fields.
	 * For string fields, this should include the space for null terminator.
	 *
	 * @generated from protobuf field: optional int32 max_size = 1;
	 */
	maxSize?: number
	/**
	 * Maximum length for 'string' fields. Setting this is equivalent
	 * to setting max_size to a value of length+1.
	 *
	 * @generated from protobuf field: optional int32 max_length = 14;
	 */
	maxLength?: number
	/**
	 * Allocated number of entries in arrays ('repeated' fields)
	 *
	 * @generated from protobuf field: optional int32 max_count = 2;
	 */
	maxCount?: number
	/**
	 * Size of integer fields. Can save some memory if you don't need
	 * full 32 bits for the value.
	 *
	 * @generated from protobuf field: optional IntSize int_size = 7;
	 */
	intSize?: IntSize
	/**
	 * Force type of field (callback or static allocation)
	 *
	 * @generated from protobuf field: optional FieldType type = 3;
	 */
	type?: FieldType
	/**
	 * Use long names for enums, i.e. EnumName_EnumValue.
	 *
	 * @generated from protobuf field: optional bool long_names = 4;
	 */
	longNames?: boolean
	/**
	 * Add 'packed' attribute to generated structs.
	 * Note: this cannot be used on CPUs that break on unaligned
	 * accesses to variables.
	 *
	 * @generated from protobuf field: optional bool packed_struct = 5;
	 */
	packedStruct?: boolean
	/**
	 * Add 'packed' attribute to generated enums.
	 *
	 * @generated from protobuf field: optional bool packed_enum = 10;
	 */
	packedEnum?: boolean
	/**
	 * Skip this message
	 *
	 * @generated from protobuf field: optional bool skip_message = 6;
	 */
	skipMessage?: boolean
	/**
	 * Generate oneof fields as normal optional fields instead of union.
	 *
	 * @generated from protobuf field: optional bool no_unions = 8;
	 */
	noUnions?: boolean
	/**
	 * integer type tag for a message
	 *
	 * @generated from protobuf field: optional uint32 msgid = 9;
	 */
	msgid?: number
	/**
	 * decode oneof as anonymous union
	 *
	 * @generated from protobuf field: optional bool anonymous_oneof = 11;
	 */
	anonymousOneof?: boolean
	/**
	 * Proto3 singular field does not generate a "has_" flag
	 *
	 * @generated from protobuf field: optional bool proto3 = 12;
	 */
	proto3?: boolean
	/**
	 * Generate an enum->string mapping function (can take up lots of space).
	 *
	 * @generated from protobuf field: optional bool enum_to_string = 13;
	 */
	enumToString?: boolean
	/**
	 * Generate bytes arrays with fixed length
	 *
	 * @generated from protobuf field: optional bool fixed_length = 15;
	 */
	fixedLength?: boolean
}
/**
 * @generated from protobuf enum FieldType
 */
export enum FieldType {
	/**
	 * Automatically decide field type, generate static field if possible.
	 *
	 * @generated from protobuf enum value: FT_DEFAULT = 0;
	 */
	FT_DEFAULT = 0,
	/**
	 * Always generate a callback field.
	 *
	 * @generated from protobuf enum value: FT_CALLBACK = 1;
	 */
	FT_CALLBACK = 1,
	/**
	 * Always generate a dynamically allocated field.
	 *
	 * @generated from protobuf enum value: FT_POINTER = 4;
	 */
	FT_POINTER = 4,
	/**
	 * Generate a static field or raise an exception if not possible.
	 *
	 * @generated from protobuf enum value: FT_STATIC = 2;
	 */
	FT_STATIC = 2,
	/**
	 * Ignore the field completely.
	 *
	 * @generated from protobuf enum value: FT_IGNORE = 3;
	 */
	FT_IGNORE = 3,
	/**
	 * Legacy option, use the separate 'fixed_length' option instead
	 *
	 * @generated from protobuf enum value: FT_INLINE = 5;
	 */
	FT_INLINE = 5,
}
/**
 * @generated from protobuf enum IntSize
 */
export enum IntSize {
	/**
	 * Default, 32/64bit based on type in .proto
	 *
	 * @generated from protobuf enum value: IS_DEFAULT = 0;
	 */
	IS_DEFAULT = 0,
	/**
	 * @generated from protobuf enum value: IS_8 = 8;
	 */
	IS_8 = 8,
	/**
	 * @generated from protobuf enum value: IS_16 = 16;
	 */
	IS_16 = 16,
	/**
	 * @generated from protobuf enum value: IS_32 = 32;
	 */
	IS_32 = 32,
	/**
	 * @generated from protobuf enum value: IS_64 = 64;
	 */
	IS_64 = 64,
}
// @generated message type with reflection information, may provide speed optimized methods
class NanoPBOptions$Type extends MessageType<NanoPBOptions> {
	constructor() {
		super('NanoPBOptions', [
			{
				no: 1,
				name: 'max_size',
				kind: 'scalar',
				opt: true,
				T: 5 /*ScalarType.INT32*/,
			},
			{
				no: 14,
				name: 'max_length',
				kind: 'scalar',
				opt: true,
				T: 5 /*ScalarType.INT32*/,
			},
			{
				no: 2,
				name: 'max_count',
				kind: 'scalar',
				opt: true,
				T: 5 /*ScalarType.INT32*/,
			},
			{
				no: 7,
				name: 'int_size',
				kind: 'enum',
				opt: true,
				T: () => ['IntSize', IntSize],
			},
			{
				no: 3,
				name: 'type',
				kind: 'enum',
				opt: true,
				T: () => ['FieldType', FieldType],
			},
			{
				no: 4,
				name: 'long_names',
				kind: 'scalar',
				opt: true,
				T: 8 /*ScalarType.BOOL*/,
			},
			{
				no: 5,
				name: 'packed_struct',
				kind: 'scalar',
				opt: true,
				T: 8 /*ScalarType.BOOL*/,
			},
			{
				no: 10,
				name: 'packed_enum',
				kind: 'scalar',
				opt: true,
				T: 8 /*ScalarType.BOOL*/,
			},
			{
				no: 6,
				name: 'skip_message',
				kind: 'scalar',
				opt: true,
				T: 8 /*ScalarType.BOOL*/,
			},
			{
				no: 8,
				name: 'no_unions',
				kind: 'scalar',
				opt: true,
				T: 8 /*ScalarType.BOOL*/,
			},
			{
				no: 9,
				name: 'msgid',
				kind: 'scalar',
				opt: true,
				T: 13 /*ScalarType.UINT32*/,
			},
			{
				no: 11,
				name: 'anonymous_oneof',
				kind: 'scalar',
				opt: true,
				T: 8 /*ScalarType.BOOL*/,
			},
			{
				no: 12,
				name: 'proto3',
				kind: 'scalar',
				opt: true,
				T: 8 /*ScalarType.BOOL*/,
			},
			{
				no: 13,
				name: 'enum_to_string',
				kind: 'scalar',
				opt: true,
				T: 8 /*ScalarType.BOOL*/,
			},
			{
				no: 15,
				name: 'fixed_length',
				kind: 'scalar',
				opt: true,
				T: 8 /*ScalarType.BOOL*/,
			},
		])
	}
	create(value?: PartialMessage<NanoPBOptions>): NanoPBOptions {
		const message = {}
		globalThis.Object.defineProperty(message, MESSAGE_TYPE, {
			enumerable: false,
			value: this,
		})
		if (value !== undefined)
			reflectionMergePartial<NanoPBOptions>(this, message, value)
		return message
	}
	internalBinaryRead(
		reader: IBinaryReader,
		length: number,
		options: BinaryReadOptions,
		target?: NanoPBOptions,
	): NanoPBOptions {
		let message = target ?? this.create(),
			end = reader.pos + length
		while (reader.pos < end) {
			let [fieldNo, wireType] = reader.tag()
			switch (fieldNo) {
				case /* optional int32 max_size */ 1:
					message.maxSize = reader.int32()
					break
				case /* optional int32 max_length */ 14:
					message.maxLength = reader.int32()
					break
				case /* optional int32 max_count */ 2:
					message.maxCount = reader.int32()
					break
				case /* optional IntSize int_size */ 7:
					message.intSize = reader.int32()
					break
				case /* optional FieldType type */ 3:
					message.type = reader.int32()
					break
				case /* optional bool long_names */ 4:
					message.longNames = reader.bool()
					break
				case /* optional bool packed_struct */ 5:
					message.packedStruct = reader.bool()
					break
				case /* optional bool packed_enum */ 10:
					message.packedEnum = reader.bool()
					break
				case /* optional bool skip_message */ 6:
					message.skipMessage = reader.bool()
					break
				case /* optional bool no_unions */ 8:
					message.noUnions = reader.bool()
					break
				case /* optional uint32 msgid */ 9:
					message.msgid = reader.uint32()
					break
				case /* optional bool anonymous_oneof */ 11:
					message.anonymousOneof = reader.bool()
					break
				case /* optional bool proto3 */ 12:
					message.proto3 = reader.bool()
					break
				case /* optional bool enum_to_string */ 13:
					message.enumToString = reader.bool()
					break
				case /* optional bool fixed_length */ 15:
					message.fixedLength = reader.bool()
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
		message: NanoPBOptions,
		writer: IBinaryWriter,
		options: BinaryWriteOptions,
	): IBinaryWriter {
		/* optional int32 max_size = 1; */
		if (message.maxSize !== undefined)
			writer.tag(1, WireType.Varint).int32(message.maxSize)
		/* optional int32 max_length = 14; */
		if (message.maxLength !== undefined)
			writer.tag(14, WireType.Varint).int32(message.maxLength)
		/* optional int32 max_count = 2; */
		if (message.maxCount !== undefined)
			writer.tag(2, WireType.Varint).int32(message.maxCount)
		/* optional IntSize int_size = 7; */
		if (message.intSize !== undefined)
			writer.tag(7, WireType.Varint).int32(message.intSize)
		/* optional FieldType type = 3; */
		if (message.type !== undefined)
			writer.tag(3, WireType.Varint).int32(message.type)
		/* optional bool long_names = 4; */
		if (message.longNames !== undefined)
			writer.tag(4, WireType.Varint).bool(message.longNames)
		/* optional bool packed_struct = 5; */
		if (message.packedStruct !== undefined)
			writer.tag(5, WireType.Varint).bool(message.packedStruct)
		/* optional bool packed_enum = 10; */
		if (message.packedEnum !== undefined)
			writer.tag(10, WireType.Varint).bool(message.packedEnum)
		/* optional bool skip_message = 6; */
		if (message.skipMessage !== undefined)
			writer.tag(6, WireType.Varint).bool(message.skipMessage)
		/* optional bool no_unions = 8; */
		if (message.noUnions !== undefined)
			writer.tag(8, WireType.Varint).bool(message.noUnions)
		/* optional uint32 msgid = 9; */
		if (message.msgid !== undefined)
			writer.tag(9, WireType.Varint).uint32(message.msgid)
		/* optional bool anonymous_oneof = 11; */
		if (message.anonymousOneof !== undefined)
			writer.tag(11, WireType.Varint).bool(message.anonymousOneof)
		/* optional bool proto3 = 12; */
		if (message.proto3 !== undefined)
			writer.tag(12, WireType.Varint).bool(message.proto3)
		/* optional bool enum_to_string = 13; */
		if (message.enumToString !== undefined)
			writer.tag(13, WireType.Varint).bool(message.enumToString)
		/* optional bool fixed_length = 15; */
		if (message.fixedLength !== undefined)
			writer.tag(15, WireType.Varint).bool(message.fixedLength)
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
 * @generated MessageType for protobuf message NanoPBOptions
 */
export const NanoPBOptions = new NanoPBOptions$Type()