import { z } from 'zod';
export function toClaudeJsonSchema(schema) {
    const jsonSchema = z.toJSONSchema(schema);
    delete jsonSchema.$schema;
    return jsonSchema;
}
