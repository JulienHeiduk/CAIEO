import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <SignUp />
    </div>
  )
}
