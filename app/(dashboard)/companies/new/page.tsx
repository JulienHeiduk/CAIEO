export const dynamic = 'force-dynamic'

import { CompanyCreateForm } from '@/components/companies/CompanyCreateForm'

export default function NewCompanyPage() {
  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="font-heading text-3xl mb-2" style={{ color: 'var(--caio-text)', fontWeight: 700 }}>
          New Project
        </h1>
        <p className="font-mono text-xs" style={{ color: 'var(--caio-text-muted)', lineHeight: 1.7 }}>
          Describe your startup idea — CAIO will generate a company name, brand,
          growth strategy, and a daily action plan. You approve before anything goes live.
        </p>
      </div>
      <CompanyCreateForm />
    </div>
  )
}
