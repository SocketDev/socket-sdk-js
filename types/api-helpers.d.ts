/**
 * @file Helper types for generated OpenAPI responses.
 */

export type OpResponseBody<Response> = Response extends {
  content: infer Content
}
  ? [Content] extends [never]
    ? undefined
    : Content[keyof Content]
  : undefined

export type OpResponsesByStatus<Responses, Prefix extends string> = {
  [Status in keyof Responses]: Status extends string | number
    ? `${Status}` extends `${Prefix}${string}`
      ? OpResponseBody<Responses[Status]>
      : never
    : never
}[keyof Responses]

export type OpReturnType<Operation> = Operation extends {
  responses: infer Responses
}
  ? OpResponsesByStatus<Responses, '2'>
  : unknown

export type OpErrorType<Operation> = Operation extends {
  responses: infer Responses
}
  ? [OpResponsesByStatus<Responses, '4' | '5'>] extends [never]
    ? { error?: string | undefined }
    : OpResponsesByStatus<Responses, '4' | '5'>
  : { error?: string | undefined }
