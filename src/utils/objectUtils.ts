// src/utils/objectUtils.ts

function isObject(item: any): item is Record<string, any> {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Performs a deep merge of objects. This is an immutable operation.
 * Unlike Object.assign, it merges nested objects and concatenates arrays.
 * @param target The target object.
 * @param sources The source object(s).
 * @returns A new object with the merged properties.
 */
export function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) {
    return target;
  }

  const output = { ...target };

  sources.forEach(source => {
    if (isObject(source)) {
      Object.keys(source).forEach(key => {
        const keyofT = key as keyof T;
        if (isObject(source[keyofT])) {
          if (!(keyofT in output)) {
            Object.assign(output, { [keyofT]: source[keyofT] });
          } else {
            output[keyofT] = deepMerge(output[keyofT] as object, source[keyofT] as object) as T[keyof T];
          }
        } else if (Array.isArray(source[keyofT]) && Array.isArray(output[keyofT])) {
          // If both are arrays, concatenate them.
          const targetArray = output[keyofT] as any[];
          const sourceArray = source[keyofT] as any[];
          (output as any)[keyofT] = targetArray.concat(sourceArray);
        } else {
          Object.assign(output, { [keyofT]: source[keyofT] });
        }
      });
    }
  });

  return output;
}
