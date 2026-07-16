import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="mb-8 text-center">
          <p className="font-display text-4xl font-bold lowercase tracking-tight text-gray-900">
            nayora<span className="text-brand-500">.</span>
          </p>
          <p className="mt-2 text-sm text-gray-500">Sign in to continue</p>
        </div>

        <div className="card p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
