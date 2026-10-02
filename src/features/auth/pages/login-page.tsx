import { useEffect } from "react"
import { Link } from "react-router"

import { useZodForm } from "@/shared/lib/forms"
import { Button } from "@/shared/ui/button"
import { Field } from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"
import { PasswordInput } from "@/shared/ui/password-input"

import { AuthLayout } from "../components/auth-layout"
import { loginSchema } from "../schemas"

/**
 * `/login` (UX-DR46/57/59/11/54). Static until Story 1.4: client-side checks only, no API call.
 * Valid input does nothing visible yet.
 */
export function LoginPage() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = "Sign in · EventHub"
    return () => {
      document.title = previousTitle
    }
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useZodForm(loginSchema, { defaultValues: { email: "", password: "" } })

  const onValid = () => {
    // Story 1.4 wires POST /api/auth/login here.
  }

  return (
    <AuthLayout>
      <h1 className="text-center text-display">Sign in</h1>
      <p className="mt-1.5 mb-5.5 text-center text-muted-foreground">Welcome back. Sign in to manage your events.</p>

      <form noValidate onSubmit={handleSubmit(onValid)} className="grid gap-4">
        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" inputMode="email" autoComplete="email" spellCheck={false} {...register("email")} />
        </Field>

        <Field label="Password" required error={errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...register("password")} />
        </Field>

        <div className="-mt-1.5 flex justify-end">
          <Button asChild variant="link">
            <Link to="/forgot-password">Forgot password?</Link>
          </Button>
        </div>

        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
