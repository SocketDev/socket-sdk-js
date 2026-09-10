/**
 * @file Structural helpers for published Socket SDK types.
 */
export type RemapSdkType<T> = { [Key in keyof T]: T[Key] }

export type SocketSdkJsonValue =
  | null
  | boolean
  | number
  | string
  | SocketSdkJsonValue[]
  | { [key: string]: SocketSdkJsonValue }
