import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, type FieldValues, type UseFormProps } from "react-hook-form"
import type { z } from "zod"

/**
 * RHF + Zod in one call (AD-2): Zod mirrors the server validator for UX only; the server stays the
 * authority and its `validation` errors are applied to fields via `shared/lib/problem` (later story).
 * Validation runs on blur, then live (UX-DR15).
 */
export function useZodForm<TInput extends FieldValues, TOutput extends FieldValues>(
  schema: z.ZodType<TOutput, TInput>,
  options?: Omit<UseFormProps<TInput, unknown, TOutput>, "resolver">,
) {
  return useForm<TInput, unknown, TOutput>({
    mode: "onTouched",
    ...options,
    resolver: zodResolver(schema),
  })
}
